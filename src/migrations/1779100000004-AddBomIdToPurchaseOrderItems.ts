import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBomIdToPurchaseOrderItems1779100000004
  implements MigrationInterface
{
  name = 'AddBomIdToPurchaseOrderItems1779100000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "purchase_order_items"
      ADD COLUMN IF NOT EXISTS "bom_id" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_purchase_order_items_bom_id"
      ON "purchase_order_items"("bom_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_purchase_order_items_bom_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "purchase_order_items"
      DROP COLUMN IF EXISTS "bom_id"
    `);
  }
}
