import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPurchaseOrderIdToApprovalRecords1778296227002 implements MigrationInterface {
  // PostgreSQL ALTER TYPE ADD VALUE 不能在事务内执行
  transaction = false;
  name = 'AddPurchaseOrderIdToApprovalRecords1778296227002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "approval_records"
      ADD COLUMN IF NOT EXISTS "purchase_order_id" uuid
    `);

    // TypeORM 使用 PostgreSQL enum 类型，需要添加新值
    await queryRunner.query(`
      ALTER TYPE "approval_records_type_enum" ADD VALUE IF NOT EXISTS 'purchase_order'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "approval_records"
      DROP COLUMN IF EXISTS "purchase_order_id"
    `);
    // PostgreSQL enum 不支持删除值，此处不还原 enum
  }
}
