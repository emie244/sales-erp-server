import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpuCodeAndSyncFields implements MigrationInterface {
  name = 'AddSpuCodeAndSyncFields';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Product 表新增字段
    await queryRunner.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS spu_code VARCHAR(32),
      ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_products_spu_code ON products(spu_code);
    `);

    // ProductSku 表新增字段
    await queryRunner.query(`
      ALTER TABLE product_skus
      ADD COLUMN IF NOT EXISTS sync_status VARCHAR(16) NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS sync_error_message TEXT,
      ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_product_skus_sync_status ON product_skus(sync_status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
      DROP COLUMN IF EXISTS spu_code,
      DROP COLUMN IF EXISTS is_draft;
    `);

    await queryRunner.query(`
      ALTER TABLE product_skus
      DROP COLUMN IF EXISTS sync_status,
      DROP COLUMN IF EXISTS sync_error_message,
      DROP COLUMN IF EXISTS last_sync_at;
    `);
  }
}
