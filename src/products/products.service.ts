import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductSku } from './entities/product-sku.entity';
import { PricePolicy } from './entities/price-policy.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { SetPriceDto } from './dto/set-price.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(ProductSku) private skuRepo: Repository<ProductSku>,
    @InjectRepository(PricePolicy) private priceRepo: Repository<PricePolicy>,
    private readonly dataSource: DataSource,
  ) {}

  private getCategoryPrefix(category?: string): string {
    if (!category) return 'CP';
    const c = category.trim();
    if (c.includes('成品')) return 'CP';
    if (c.includes('原材料')) return 'YL';
    if (c.includes('包装')) return 'BZ';
    return c.substring(0, 2).toUpperCase();
  }

  private getBrandPrefix(brand?: string): string {
    if (!brand) return 'EM';
    const b = brand.trim().toUpperCase();
    if (b === 'EMIE') return 'EM';
    return b.substring(0, 2).toUpperCase();
  }

  private async generateSkuCode(category?: string, brand?: string): Promise<string> {
    const brandPrefix = this.getBrandPrefix(brand);
    const categoryPrefix = this.getCategoryPrefix(category);
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const pattern = `${brandPrefix}-${categoryPrefix}-${dateStr}-%`;

    const latest = await this.skuRepo
      .createQueryBuilder('sku')
      .where('sku.skuCode LIKE :pattern', { pattern })
      .orderBy('sku.skuCode', 'DESC')
      .getOne();

    let seq = 1;
    if (latest?.skuCode) {
      const match = latest.skuCode.match(/-(\d{3})$/);
      if (match) seq = parseInt(match[1], 10) + 1;
    }

    return `${brandPrefix}-${categoryPrefix}-${dateStr}-${String(seq).padStart(3, '0')}`;
  }

  async create(dto: CreateProductDto, tenantId?: string) {
    const product = this.productRepo.create({
      name: dto.name,
      description: dto.description,
      category: dto.category,
      tenantId,
    });
    const saved = await this.productRepo.save(product);

    const brand = 'EMIE'; // 默认为 EMIE，后续可从配置或用户选择获取

    if (dto.skus?.length) {
      const skus = await Promise.all(
        dto.skus.map(async (s) => {
          const skuCode = s.skuCode?.trim()
            ? s.skuCode.trim()
            : await this.generateSkuCode(saved.category, brand);
          const skuName = s.skuName?.trim()
            ? s.skuName.trim()
            : `${saved.name}${s.spec ? ' / ' + s.spec : ''}`;
          return this.skuRepo.create({
            ...s,
            skuCode,
            skuName,
            productId: saved.id,
            brand,
            category: saved.category,
          });
        }),
      );
      await this.skuRepo.save(skus);
    } else {
      // 没有提供 SKU 时，自动生成一个默认 SKU
      const skuCode = await this.generateSkuCode(saved.category, brand);
      const skuName = saved.name;
      const defaultSku = this.skuRepo.create({
        skuCode,
        skuName,
        productId: saved.id,
        brand,
        category: saved.category,
        weight: 0,
      });
      await this.skuRepo.save(defaultSku);
    }
    return this.findOne(saved.id);
  }

  async findOne(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['skus'],
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findAll(page: number = 1, pageSize: number = 20, tenantId?: string) {
    const [data, total] = await this.productRepo.findAndCount({
      where: tenantId ? { tenantId } : {},
      relations: ['skus'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total, page, pageSize };
  }

  async findAllSkus(page: number = 1, pageSize: number = 50, tenantId?: string, keyword?: string, status?: string) {
    const qb = this.skuRepo.createQueryBuilder('ps')
      .leftJoinAndSelect('ps.product', 'p')
      .orderBy('ps.createdAt', 'DESC');

    if (tenantId) {
      qb.andWhere('p.tenantId = :tenantId', { tenantId });
    }

    if (keyword) {
      qb.andWhere(
        `(ps.skuName ILIKE :keyword OR ps.skuCode ILIKE :keyword OR ps.jstSkuId ILIKE :keyword OR p.name ILIKE :keyword)`,
        { keyword: `%${keyword}%` },
      );
    }

    let skus: ProductSku[];
    let total: number;

    if (!status) {
      qb.skip((page - 1) * pageSize).take(pageSize);
      const [result, count] = await qb.getManyAndCount();
      skus = result;
      total = count;
    } else {
      skus = await qb.getMany();
      total = skus.length;
    }

    const skuKeys = skus.map((s) => s.jstSkuId || s.skuCode).filter(Boolean);
    if (skuKeys.length) {
      const stockSummary = (await this.dataSource.query(
        `
        SELECT sku_id, SUM("availableQty") as total,
          bool_or(safety_stock > 0 AND "availableQty" <= 0) as has_danger,
          bool_or(safety_stock > 0 AND "availableQty" < safety_stock AND "availableQty" > 0) as has_warning
        FROM stock_snapshots
        WHERE sku_id = ANY($1)
        GROUP BY sku_id
        `,
        [skuKeys],
      )) as any[];

      const bomSummary = (await this.dataSource.query(
        `
        SELECT sku_id, version
        FROM bom_headers
        WHERE sku_id = ANY($1) AND "isActive" = true
        `,
        [skuKeys],
      )) as any[];

      const stockMap = new Map(stockSummary.map((s: any) => [s.sku_id, s]));
      const bomMap = new Map(bomSummary.map((b: any) => [b.sku_id, b]));

      for (const sku of skus) {
        const key = sku.jstSkuId || sku.skuCode;
        const stock = key ? stockMap.get(key) : undefined;
        if (stock) {
          (sku as any).totalAvailableQty = Number(stock.total) || 0;
          if (stock.has_danger) (sku as any).stockStatus = 'danger';
          else if (stock.has_warning) (sku as any).stockStatus = 'warning';
          else (sku as any).stockStatus = 'normal';
        } else {
          (sku as any).totalAvailableQty = 0;
          (sku as any).stockStatus = 'normal';
        }

        const bom = key ? bomMap.get(key) : undefined;
        (sku as any).bomVersion = bom?.version || null;
      }
    }

    if (status) {
      const filtered = skus.filter((s: any) => s.stockStatus === status);
      total = filtered.length;
      const offset = (page - 1) * pageSize;
      skus = filtered.slice(offset, offset + pageSize);
    }

    return { data: skus, total, page, pageSize };
  }

  async setPrice(dto: SetPriceDto) {
    const existing = await this.priceRepo.findOne({
      where: { skuId: dto.skuId, customerLevel: dto.customerLevel },
    });
    if (existing) {
      existing.price = dto.price;
      existing.minQty = dto.minQty;
      return this.priceRepo.save(existing);
    }
    return this.priceRepo.save(this.priceRepo.create(dto));
  }

  async getPrice(skuId: string, customerLevel: string) {
    const policy = await this.priceRepo.findOne({
      where: { skuId, customerLevel },
    });
    return policy ?? null;
  }

  async findSkuById(skuId: string, tenantId?: string) {
    return this.skuRepo.findOne({
      where: tenantId
        ? { id: skuId, product: { tenantId } }
        : { id: skuId },
      relations: ['product'],
    });
  }

  async findSkusByProductId(productId: string) {
    if (!productId) return [];
    return this.skuRepo.find({
      where: { productId },
      order: { createdAt: 'DESC' },
    });
  }

  async upsertFromJushuitan(skus: any[]) {
    let createdProducts = 0;
    let updatedProducts = 0;
    let createdSkus = 0;
    let updatedSkus = 0;

    for (const s of skus) {
      const jstGoodsId = String(s.i_id || '');
      const jstSkuId = String(s.sku_id || '');
      const productName = String(s.name || '');
      const skuName = String(s.sku_name || s.properties_value || '');
      const skuCode = String(s.sku_code || jstSkuId);
      const propertiesValue = String(s.properties_value || '');
      const category = String(s.category || '');
      const brand = String(s.brand || '');
      const pic = String(s.pic || s.pic_big || '');
      const salePrice = s.sale_price != null ? Number(s.sale_price) : null;
      const costPrice = s.cost_price != null ? Number(s.cost_price) : null;

      if (!jstSkuId) continue;

      let product = await this.productRepo.findOne({ where: { jstGoodsId } });
      if (!product) {
        product = await this.productRepo.save(
          this.productRepo.create({ name: productName, jstGoodsId, category }),
        );
        createdProducts++;
      } else {
        product.name = productName;
        product.category = category;
        await this.productRepo.save(product);
        updatedProducts++;
      }

      const existingSku = await this.skuRepo.findOne({ where: { jstSkuId } });
      if (!existingSku) {
        const newSku = this.skuRepo.create({
          productId: product.id,
          skuCode,
          skuName,
          jstSkuId,
          propertiesValue,
          category,
          brand,
          pic,
          salePrice,
          costPrice,
        });
        await this.skuRepo.save(newSku);
        createdSkus++;
      } else {
        existingSku.skuCode = skuCode;
        existingSku.skuName = skuName;
        existingSku.propertiesValue = propertiesValue;
        existingSku.category = category;
        existingSku.brand = brand;
        existingSku.pic = pic;
        existingSku.salePrice = salePrice;
        existingSku.costPrice = costPrice;
        await this.skuRepo.save(existingSku);
        updatedSkus++;
      }
    }

    return { createdProducts, updatedProducts, createdSkus, updatedSkus };
  }
}
