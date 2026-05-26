import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVouchersTable1780000000014 implements MigrationInterface {
  name = 'CreateVouchersTable1780000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE voucher_type_enum AS ENUM ('receivable', 'receipt', 'payment', 'adjustment');
    `);

    await queryRunner.query(`
      CREATE TYPE voucher_status_enum AS ENUM ('draft', 'posted', 'cancelled');
    `);

    await queryRunner.query(`
      CREATE TABLE vouchers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        voucher_no VARCHAR(255) NOT NULL,
        voucher_date DATE NOT NULL,
        type voucher_type_enum DEFAULT 'adjustment',
        description TEXT,
        total_amount DECIMAL(14,2) NOT NULL,
        status voucher_status_enum DEFAULT 'draft',
        source_type VARCHAR(255),
        source_id UUID,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_vouchers_source ON vouchers(source_type, source_id);
    `);

    await queryRunner.query(`
      CREATE TABLE voucher_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        voucher_id UUID NOT NULL,
        account_code VARCHAR(255) NOT NULL,
        account_name VARCHAR(255),
        debit_amount DECIMAL(14,2) DEFAULT 0,
        credit_amount DECIMAL(14,2) DEFAULT 0,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_voucher_items_voucher_id ON voucher_items(voucher_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS voucher_items;`);
    await queryRunner.query(`DROP TABLE IF EXISTS vouchers;`);
    await queryRunner.query(`DROP TYPE IF EXISTS voucher_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS voucher_type_enum;`);
  }
}
