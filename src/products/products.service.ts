import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async create(dto: CreateProductDto, tenantId?: string) {
    const product = this.productRepo.create({
      name: dto.name,
      description: dto.description,
      category: dto.category,
      tenantId,
    });
    const saved = await this.productRepo.save(product);

    if (dto.skus?.length) {
      const skus = dto.skus.map((s) =>
        this.skuRepo.create({ ...s, productId: saved.id }),
      );
      await this.skuRepo.save(skus);
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

  async findAllSkus(page: number = 1, pageSize: number = 50, tenantId?: string) {
    const [data, total] = await this.skuRepo.findAndCount({
      where: tenantId ? { product: { tenantId } } : {},
      relations: ['product'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total, page, pageSize };
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
