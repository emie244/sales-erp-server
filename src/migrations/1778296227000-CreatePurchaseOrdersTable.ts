import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePurchaseOrdersTable1778296227000 implements MigrationInterface {
  name = 'CreatePurchaseOrdersTable1778296227000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchase_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_no" character varying NOT NULL,
        "supplier_id" uuid NOT NULL,
        "supplier_name" character varying,
        "status" character varying NOT NULL DEFAULT 'draft',
        "total_amount" numeric(14,2) NOT NULL DEFAULT 0,
        "remark" character varying,
        "approval_instance_code" character varying,
        "creator_id" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_purchase_orders_order_no" UNIQUE ("order_no"),
        CONSTRAINT "PK_purchase_orders" PRIMARY KEY ("id"),
        CONSTRAINT "FK_purchase_orders_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchase_order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "purchase_order_id" uuid NOT NULL,
        "sku_id" character varying NOT NULL,
        "sku_code" character varying,
        "sku_name" character varying,
        "qty" numeric(14,4) NOT NULL,
        "received_qty" numeric(14,4) NOT NULL DEFAULT 0,
        "unit_price" numeric(14,2) NOT NULL DEFAULT 0,
        "line_amount" numeric(14,2) NOT NULL DEFAULT 0,
        "remark" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_purchase_order_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_purchase_order_items_order" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_orders"`);
  }
}
