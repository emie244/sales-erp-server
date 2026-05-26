import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderGovernanceFields1780000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sales_orders
      ADD COLUMN IF NOT EXISTS delivery_date date,
      ADD COLUMN IF NOT EXISTS credit_warning text,
      ADD COLUMN IF NOT EXISTS floor_price_warning text;
    `);

    await queryRunner.query(`
      ALTER TABLE product_skus
      ADD COLUMN IF NOT EXISTS floor_price numeric(14, 2);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sales_orders
      DROP COLUMN IF EXISTS delivery_date,
      DROP COLUMN IF EXISTS credit_warning,
      DROP COLUMN IF EXISTS floor_price_warning;
    `);

    await queryRunner.query(`
      ALTER TABLE product_skus
      DROP COLUMN IF EXISTS floor_price;
    `);
  }
}
