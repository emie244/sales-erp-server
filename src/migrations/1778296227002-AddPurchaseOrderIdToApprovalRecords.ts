import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPurchaseOrderIdToApprovalRecords1778296227002 implements MigrationInterface {
  name = 'AddPurchaseOrderIdToApprovalRecords1778296227002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "approval_records"
      ADD COLUMN IF NOT EXISTS "purchase_order_id" uuid
    `);

    // 如果 type 列还不是 enum，需要更新以支持 purchase_order
    // 先检查当前 type 列的约束
    await queryRunner.query(`
      ALTER TABLE "approval_records"
      DROP CONSTRAINT IF EXISTS "CHK_approval_records_type"
    `);

    await queryRunner.query(`
      ALTER TABLE "approval_records"
      ADD CONSTRAINT "CHK_approval_records_type"
      CHECK ("type" IN ('sales_order', 'prepayment', 'collection', 'purchase_order'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "approval_records"
      DROP COLUMN IF EXISTS "purchase_order_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "approval_records"
      DROP CONSTRAINT IF EXISTS "CHK_approval_records_type"
    `);

    await queryRunner.query(`
      ALTER TABLE "approval_records"
      ADD CONSTRAINT "CHK_approval_records_type"
      CHECK ("type" IN ('sales_order', 'prepayment', 'collection'))
    `);
  }
}
