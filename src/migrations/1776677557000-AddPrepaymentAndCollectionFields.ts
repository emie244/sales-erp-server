import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrepaymentAndCollectionFields1776677557000 implements MigrationInterface {
  name = 'AddPrepaymentAndCollectionFields1776677557000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 创建预付款记录表
    await queryRunner.query(`
      CREATE TABLE "prepayment_records" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "customer_id" varchar(50) NOT NULL,
        "amount" numeric(14, 2) NOT NULL DEFAULT 0,
        "payment_method" varchar(50),
        "payment_date" date,
        "receipt_url" varchar(500),
        "remark" text,
        "status" varchar(50) NOT NULL DEFAULT 'pending',
        "approval_instance_code" varchar(100),
        "created_by" varchar(50),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_prepayment_customer_id" ON "prepayment_records"("customer_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_prepayment_status" ON "prepayment_records"("status")
    `);

    // 2. 扩展客户表增加预付款余额字段
    await queryRunner.query(`
      ALTER TABLE "customers" ADD COLUMN "prepayment_balance" numeric(14, 2) NOT NULL DEFAULT 0
    `);

    // 3. 扩展销售订单表增加已收款和预付款抵扣字段
    await queryRunner.query(`
      ALTER TABLE "sales_orders" ADD COLUMN "collected_amount" numeric(14, 2) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE "sales_orders" ADD COLUMN "prepayment_deducted" numeric(14, 2) NOT NULL DEFAULT 0
    `);

    // 4. 扩展回款记录表增加类型和关联字段
    await queryRunner.query(`
      ALTER TABLE "payment_records" ADD COLUMN "type" varchar(50) NOT NULL DEFAULT 'collection'
    `);

    await queryRunner.query(`
      ALTER TABLE "payment_records" ADD COLUMN "prepayment_record_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_payment_type" ON "payment_records"("type")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_payment_order_id" ON "payment_records"("sales_order_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_payment_order_id"`);
    await queryRunner.query(`DROP INDEX "idx_payment_type"`);
    await queryRunner.query(
      `ALTER TABLE "payment_records" DROP COLUMN "prepayment_record_id"`,
    );
    await queryRunner.query(`ALTER TABLE "payment_records" DROP COLUMN "type"`);

    await queryRunner.query(
      `ALTER TABLE "sales_orders" DROP COLUMN "prepayment_deducted"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" DROP COLUMN "collected_amount"`,
    );

    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN "prepayment_balance"`,
    );

    await queryRunner.query(`DROP INDEX "idx_prepayment_status"`);
    await queryRunner.query(`DROP INDEX "idx_prepayment_customer_id"`);
    await queryRunner.query(`DROP TABLE "prepayment_records"`);
  }
}
