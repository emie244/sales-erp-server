import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePurchaseRequestsTable1780000000011
  implements MigrationInterface
{
  name = 'CreatePurchaseRequestsTable1780000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE purchase_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        pr_no varchar NOT NULL UNIQUE,
        sales_order_id uuid REFERENCES sales_orders(id) ON DELETE SET NULL,
        status varchar NOT NULL DEFAULT 'draft',
        total_amount decimal(14,2) NOT NULL DEFAULT 0,
        remark text,
        creator_id uuid,
        converted_po_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_purchase_requests_sales_order_id ON purchase_requests(sales_order_id);
      CREATE INDEX idx_purchase_requests_status ON purchase_requests(status);

      CREATE TABLE purchase_request_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        purchase_request_id uuid NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
        sku_id varchar NOT NULL,
        sku_code varchar,
        sku_name varchar,
        qty decimal(14,4) NOT NULL,
        estimated_unit_price decimal(14,2),
        supplier_id uuid,
        supplier_name varchar,
        bom_id uuid,
        remark text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_pri_purchase_request_id ON purchase_request_items(purchase_request_id);
      CREATE INDEX idx_pri_sku_id ON purchase_request_items(sku_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_pri_sku_id;
      DROP INDEX IF EXISTS idx_pri_purchase_request_id;
      DROP TABLE IF EXISTS purchase_request_items;
      DROP INDEX IF EXISTS idx_purchase_requests_status;
      DROP INDEX IF EXISTS idx_purchase_requests_sales_order_id;
      DROP TABLE IF EXISTS purchase_requests;
    `);
  }
}
