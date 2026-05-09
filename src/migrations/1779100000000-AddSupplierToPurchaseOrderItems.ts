import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupplierToPurchaseOrderItems1779100000000 implements MigrationInterface {
  name = 'AddSupplierToPurchaseOrderItems1779100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "purchase_order_items"
      ADD COLUMN IF NOT EXISTS "supplier_id" uuid,
      ADD COLUMN IF NOT EXISTS "supplier_name" character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "purchase_order_items"
      ADD CONSTRAINT "FK_purchase_order_items_supplier"
      FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "purchase_order_items"
      DROP CONSTRAINT IF EXISTS "FK_purchase_order_items_supplier"
    `);

    await queryRunner.query(`
      ALTER TABLE "purchase_order_items"
      DROP COLUMN IF EXISTS "supplier_name",
      DROP COLUMN IF EXISTS "supplier_id"
    `);
  }
}
