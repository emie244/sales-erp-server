import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStockLedgerAndBalanceTables1780000000007
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stock_ledger (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sku_id uuid NOT NULL,
        type varchar(10) NOT NULL CHECK (type IN ('inbound', 'outbound')),
        qty numeric(14,4) NOT NULL,
        reference_type varchar(32) NOT NULL CHECK (reference_type IN ('sales_order','purchase_order','production_order','adjustment','initial')),
        reference_id uuid NOT NULL,
        before_qty numeric(14,4) NOT NULL,
        after_qty numeric(14,4) NOT NULL,
        remark text,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_stock_ledger_sku_date ON stock_ledger(sku_id, "createdAt");
      CREATE INDEX IF NOT EXISTS idx_stock_ledger_ref ON stock_ledger(reference_type, reference_id);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS local_stock_balances (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        sku_id uuid NOT NULL UNIQUE,
        qty numeric(14,4) NOT NULL DEFAULT 0,
        version integer NOT NULL DEFAULT 0,
        "lastUpdatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_local_stock_sku ON local_stock_balances(sku_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS stock_ledger;`);
    await queryRunner.query(`DROP TABLE IF EXISTS local_stock_balances;`);
  }
}
