import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderConsigneeAndJstIds1744816800000 implements MigrationInterface {
  name = 'AddOrderConsigneeAndJstIds1744816800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD COLUMN "consignee" varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD COLUMN "consignee_phone" varchar(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD COLUMN "consignee_address" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_items" ADD COLUMN "product_name" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_items" ADD COLUMN "jst_sku_id" varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_skus" ADD COLUMN "jst_sku_id" varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN "jst_goods_id" varchar(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales_orders" DROP COLUMN "consignee_address"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" DROP COLUMN "consignee_phone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" DROP COLUMN "consignee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_items" DROP COLUMN "jst_sku_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_items" DROP COLUMN "product_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_skus" DROP COLUMN "jst_sku_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "jst_goods_id"`,
    );
  }
}
