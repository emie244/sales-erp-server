import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductIdToSalesOrderItems1776823731000 implements MigrationInterface {
  name = 'AddProductIdToSalesOrderItems1776823731000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_order_items" 
      ADD COLUMN IF NOT EXISTS "product_id" uuid
    `);

    // 更新现有数据：根据 sku_id 查找对应的 product_id
    await queryRunner.query(`
      UPDATE "sales_order_items" soi
      SET "product_id" = s."product_id"
      FROM "product_skus" s
      WHERE soi."sku_id"::uuid = s."id"
      AND soi."product_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_order_items" 
      DROP COLUMN IF EXISTS "product_id"
    `);
  }
}
