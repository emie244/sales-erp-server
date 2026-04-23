import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAddressAndLogisticsFields1776761917000 implements MigrationInterface {
  name = 'AddAddressAndLogisticsFields1776761917000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加地址拆分字段
    await queryRunner.query(`
      ALTER TABLE "sales_orders" 
        ADD COLUMN "consignee_province" varchar(50),
        ADD COLUMN "consignee_city" varchar(50),
        ADD COLUMN "consignee_district" varchar(50),
        ADD COLUMN "consignee_town" varchar(50),
        ADD COLUMN "consignee_tel" varchar(50)
    `);

    // 添加物流字段
    await queryRunner.query(`
      ALTER TABLE "sales_orders" 
        ADD COLUMN "logistics_company" varchar(50),
        ADD COLUMN "express_no" varchar(100)
    `);

    // 添加买家留言
    await queryRunner.query(`
      ALTER TABLE "sales_orders" 
        ADD COLUMN "buyer_message" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_orders" 
        DROP COLUMN "consignee_province",
        DROP COLUMN "consignee_city",
        DROP COLUMN "consignee_district",
        DROP COLUMN "consignee_town",
        DROP COLUMN "consignee_tel",
        DROP COLUMN "logistics_company",
        DROP COLUMN "express_no",
        DROP COLUMN "buyer_message"
    `);
  }
}
