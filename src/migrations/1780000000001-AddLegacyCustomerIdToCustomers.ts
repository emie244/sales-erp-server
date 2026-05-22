import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLegacyCustomerIdToCustomers1780000000001 implements MigrationInterface {
  name = 'AddLegacyCustomerIdToCustomers1780000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customers"
        ADD COLUMN IF NOT EXISTS "legacy_customer_id" varchar;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customers" DROP COLUMN IF EXISTS "legacy_customer_id";
    `);
  }
}
