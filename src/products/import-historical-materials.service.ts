import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductSku } from './entities/product-sku.entity';
import { generateSpuCode, generateSkuCode } from './sku-code.generator';

@Injectable()
export class ImportHistoricalMaterialsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductSku)
    private readonly skuRepo: Repository<ProductSku>,
    private readonly dataSource: DataSource,
  ) {}

  async import() {
    // 获取所有历史物料编码
    const rows = await this.dataSource.query(
      `
      SELECT DISTINCT bi.material_sku_id as code, MAX(bi.remark) as name
      FROM bom_items bi
      WHERE bi.material_sku_id NOT IN (
        SELECT COALESCE("skuCode", jst_sku_id) FROM product_skus
      )
      AND bi.material_sku_id IS NOT NULL
      AND bi.material_sku_id != ''
      GROUP BY bi.material_sku_id
      ORDER BY bi.material_sku_id
      `,
    );

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const historicalCode = row.code;
      const name = row.name || historicalCode;

      // 检查是否已存在（双重检查）
      const existing = await this.skuRepo.findOne({
        where: [
          { skuCode: historicalCode },
          { jstSkuId: historicalCode },
        ],
      });
      if (existing) {
        skipped++;
        continue;
      }

      try {
        // 生成 SPU 编码（原材料前缀 YC）
        const spuCode = await generateSpuCode(this.dataSource, {
          prefix: 'YC',
          categoryCode: 'QT', // 其他
        });

        // 创建产品
        const product = this.productRepo.create({
          name,
          category: '原材料',
          itemType: 'raw_material',
          spuCode,
          isDraft: false,
          isActive: true,
        });
        await this.productRepo.save(product);

        // 生成 SKU 编码
        const skuCode = await generateSkuCode(this.dataSource, spuCode);

        // 创建 SKU
        const sku = this.skuRepo.create({
          productId: product.id,
          skuCode,
          skuName: name,
          jstSkuId: historicalCode,
          category: '原材料',
          itemType: 'raw_material',
          codeCompliant: true,
          syncStatus: 'synced',
        });
        await this.skuRepo.save(sku);

        created++;
      } catch (err: any) {
        errors.push(`${historicalCode}: ${err.message}`);
      }
    }

    return { total: rows.length, created, skipped, errors };
  }
}
