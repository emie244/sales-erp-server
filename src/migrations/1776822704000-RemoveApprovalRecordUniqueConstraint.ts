import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveApprovalRecordUniqueConstraint1776822704000 implements MigrationInterface {
  name = 'RemoveApprovalRecordUniqueConstraint1776822704000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 删除 approval_records 表上的 sales_order_id 唯一约束
    await queryRunner.query(`
      ALTER TABLE "approval_records" 
      DROP CONSTRAINT IF EXISTS "UQ_f360ffeddd6067b1017d13eecdf"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 重新添加唯一约束（如果需要回滚）
    await queryRunner.query(`
      ALTER TABLE "approval_records" 
      ADD CONSTRAINT "UQ_f360ffeddd6067b1017d13eecdf" 
      UNIQUE ("sales_order_id")
    `);
  }
}
