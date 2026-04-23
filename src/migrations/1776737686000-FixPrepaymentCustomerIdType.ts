import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPrepaymentCustomerIdType1776737686000 implements MigrationInterface {
  name = 'FixPrepaymentCustomerIdType1776737686000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 修改 customer_id 字段类型为 uuid
    await queryRunner.query(`
      ALTER TABLE "prepayment_records" ALTER COLUMN "customer_id" TYPE uuid USING "customer_id"::uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚：改回 varchar
    await queryRunner.query(`
      ALTER TABLE "prepayment_records" ALTER COLUMN "customer_id" TYPE varchar(50)
    `);
  }
}
