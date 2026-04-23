import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemovePrepaymentOrderType1776739213000 implements MigrationInterface {
  name = 'RemovePrepaymentOrderType1776739213000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 删除已有的预收款订单（这些订单未完成审批或已废弃）
    await queryRunner.query(`
      DELETE FROM "sales_orders" WHERE "type" = 'prepayment'
    `);

    // 2. 删除旧枚举类型并重新创建（不包含 prepayment）
    await queryRunner.query(`
      ALTER TABLE "sales_orders" ALTER COLUMN "type" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "sales_orders" ALTER COLUMN "type" TYPE varchar(50) USING "type"::varchar
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "sales_orders_type_enum"
    `);

    await queryRunner.query(`
      CREATE TYPE "sales_orders_type_enum" AS ENUM ('sales', 'overseas')
    `);

    await queryRunner.query(`
      ALTER TABLE "sales_orders" ALTER COLUMN "type" TYPE "sales_orders_type_enum" USING "type"::"sales_orders_type_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "sales_orders" ALTER COLUMN "type" SET DEFAULT 'sales'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 恢复预收款订单类型
    await queryRunner.query(`
      ALTER TABLE "sales_orders" ALTER COLUMN "type" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "sales_orders" ALTER COLUMN "type" TYPE varchar(50) USING "type"::varchar
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "sales_orders_type_enum"
    `);

    await queryRunner.query(`
      CREATE TYPE "sales_orders_type_enum" AS ENUM ('sales', 'prepayment', 'overseas')
    `);

    await queryRunner.query(`
      ALTER TABLE "sales_orders" ALTER COLUMN "type" TYPE "sales_orders_type_enum" USING "type"::"sales_orders_type_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "sales_orders" ALTER COLUMN "type" SET DEFAULT 'sales'
    `);
  }
}
