import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsCreditBlockedToCustomers1780000000002 implements MigrationInterface {
  name = 'AddIsCreditBlockedToCustomers1780000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customers"
        ADD COLUMN IF NOT EXISTS "is_credit_blocked" boolean NOT NULL DEFAULT false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customers" DROP COLUMN IF EXISTS "is_credit_blocked";
    `);
  }
}
