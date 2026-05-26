import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSalesOrderIdToProductionOrder1780000000009
  implements MigrationInterface
{
  name = 'AddSalesOrderIdToProductionOrder1780000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE production_orders
        ADD COLUMN sales_order_id uuid REFERENCES sales_orders(id) ON DELETE SET NULL;
      CREATE INDEX idx_production_orders_sales_order_id ON production_orders(sales_order_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_production_orders_sales_order_id;
      ALTER TABLE production_orders
        DROP COLUMN sales_order_id;
    `);
  }
}
