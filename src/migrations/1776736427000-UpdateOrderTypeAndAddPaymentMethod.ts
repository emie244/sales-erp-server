import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateOrderTypeAndAddPaymentMethod1776736427000 implements MigrationInterface {
  name = 'UpdateOrderTypeAndAddPaymentMethod1776736427000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 添加 payment_method 列
    await queryRunner.query(`
      ALTER TABLE "sales_orders" ADD COLUMN "payment_method" varchar(100)
    `);

    // 2. 处理 type 字段的枚举变更
    // 先删除默认值
    await queryRunner.query(`
      ALTER TABLE "sales_orders" ALTER COLUMN "type" DROP DEFAULT
    `);

    // 将列类型改为 varchar，解除枚举限制
    await queryRunner.query(`
      ALTER TABLE "sales_orders" ALTER COLUMN "type" TYPE varchar(50) USING "type"::varchar
    `);

    // 删除旧枚举类型
    await queryRunner.query(`
      DROP TYPE IF EXISTS "sales_orders_type_enum"
    `);

    // 创建新枚举类型
    await queryRunner.query(`
      CREATE TYPE "sales_orders_type_enum" AS ENUM ('sales', 'prepayment', 'overseas')
    `);

    // 更新现有数据（所有旧类型都映射为 sales）
    await queryRunner.query(`
      UPDATE "sales_orders" SET "type" = 'sales' WHERE "type" IN ('wholesale', 'retail', 'return')
    `);

    // 将列类型改为新枚举
    await queryRunner.query(`
      ALTER TABLE "sales_orders" ALTER COLUMN "type" TYPE "sales_orders_type_enum" USING "type"::"sales_orders_type_enum"
    `);

    // 设置新的默认值
    await queryRunner.query(`
      ALTER TABLE "sales_orders" ALTER COLUMN "type" SET DEFAULT 'sales'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. 删除 payment_method 列
    await queryRunner.query(`
      ALTER TABLE "sales_orders" DROP COLUMN "payment_method"
    `);

    // 2. 恢复 type 枚举
    await queryRunner.query(`
      ALTER TYPE "sales_orders_type_enum" RENAME TO "sales_orders_type_enum_old"
    `);

    await queryRunner.query(`
      CREATE TYPE "sales_orders_type_enum" AS ENUM ('wholesale', 'retail', 'return')
    `);

    await queryRunner.query(`
      ALTER TABLE "sales_orders" ALTER COLUMN "type" TYPE "sales_orders_type_enum" USING "type"::text::"sales_orders_type_enum"
    `);

    await queryRunner.query(`
      DROP TYPE "sales_orders_type_enum_old"
    `);

    // 3. 恢复数据
    await queryRunner.query(`
      UPDATE "sales_orders" SET "type" = 'wholesale' WHERE "type" = 'sales'
    `);
  }
}
