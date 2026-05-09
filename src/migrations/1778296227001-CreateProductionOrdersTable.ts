import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductionOrdersTable1778296227001 implements MigrationInterface {
  name = 'CreateProductionOrdersTable1778296227001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "production_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_no" character varying NOT NULL,
        "bom_id" uuid NOT NULL,
        "sku_id" character varying NOT NULL,
        "sku_name" character varying,
        "qty" numeric(14,4) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "remark" character varying,
        "creator_id" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_production_orders_order_no" UNIQUE ("order_no"),
        CONSTRAINT "PK_production_orders" PRIMARY KEY ("id"),
        CONSTRAINT "FK_production_orders_bom" FOREIGN KEY ("bom_id") REFERENCES "bom_headers"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "production_order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "production_order_id" uuid NOT NULL,
        "material_sku_id" character varying NOT NULL,
        "material_sku_name" character varying,
        "required_qty" numeric(14,4) NOT NULL,
        "actual_qty" numeric(14,4) NOT NULL DEFAULT 0,
        "remark" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_production_order_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_production_order_items_order" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "production_order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "production_orders"`);
  }
}
