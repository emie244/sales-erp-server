import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeduplicateBomHeadersAndAddUniqueConstraint1779100000001 implements MigrationInterface {
  name = 'DeduplicateBomHeadersAndAddUniqueConstraint1779100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 删除重复的 bom_items（关联到将被删除的 bom_headers）
    await queryRunner.query(`
      DELETE FROM bom_items
      WHERE bom_header_id IN (
        SELECT id FROM (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY sku_id, version
              ORDER BY created_at DESC
            ) as rn
          FROM bom_headers
        ) t WHERE rn > 1
      )
    `);

    // 2. 删除重复的 bom_headers，保留每个 (sku_id, version) 中最新的一条
    await queryRunner.query(`
      DELETE FROM bom_headers
      WHERE id IN (
        SELECT id FROM (
          SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY sku_id, version
              ORDER BY created_at DESC
            ) as rn
          FROM bom_headers
        ) t WHERE rn > 1
      )
    `);

    // 3. 添加唯一约束
    await queryRunner.query(`
      ALTER TABLE bom_headers
      ADD CONSTRAINT uq_bom_headers_product_sku_version
      UNIQUE (product_id, sku_id, version)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bom_headers
      DROP CONSTRAINT IF EXISTS uq_bom_headers_product_sku_version
    `);
  }
}
