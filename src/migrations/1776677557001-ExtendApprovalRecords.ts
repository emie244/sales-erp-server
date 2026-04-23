import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendApprovalRecords1776677557001 implements MigrationInterface {
  name = 'ExtendApprovalRecords1776677557001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 移除sales_order_id的unique约束
    await queryRunner.query(`
      ALTER TABLE "approval_records" DROP CONSTRAINT IF EXISTS "UQ_approval_records_sales_order_id"
    `);

    // 添加类型字段
    await queryRunner.query(`
      ALTER TABLE "approval_records" ADD COLUMN "type" varchar(50) NOT NULL DEFAULT 'sales_order'
    `);

    // 添加预付款关联字段
    await queryRunner.query(`
      ALTER TABLE "approval_records" ADD COLUMN "prepayment_record_id" uuid
    `);

    // 添加回款关联字段
    await queryRunner.query(`
      ALTER TABLE "approval_records" ADD COLUMN "payment_record_id" uuid
    `);

    // 修改sales_order_id为nullable
    await queryRunner.query(`
      ALTER TABLE "approval_records" ALTER COLUMN "sales_order_id" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "approval_records" ALTER COLUMN "sales_order_id" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "approval_records" DROP COLUMN "payment_record_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "approval_records" DROP COLUMN "prepayment_record_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "approval_records" DROP COLUMN "type"
    `);
    await queryRunner.query(`
      ALTER TABLE "approval_records" ADD CONSTRAINT "UQ_approval_records_sales_order_id" UNIQUE ("sales_order_id")
    `);
  }
}
