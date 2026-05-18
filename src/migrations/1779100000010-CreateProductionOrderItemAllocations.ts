import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductionOrderItemAllocations1779100000010 implements MigrationInterface {
  name = 'CreateProductionOrderItemAllocations1779100000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS production_order_item_allocations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        production_order_item_id uuid NOT NULL,
        purchase_order_item_id uuid NOT NULL,
        qty numeric(14,4) NOT NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS production_order_item_allocations;
    `);
  }
}
