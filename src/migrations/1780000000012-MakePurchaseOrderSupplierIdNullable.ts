import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakePurchaseOrderSupplierIdNullable1780000000012
  implements MigrationInterface
{
  name = 'MakePurchaseOrderSupplierIdNullable1780000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE purchase_orders
        ALTER COLUMN supplier_id DROP NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE purchase_orders
        ALTER COLUMN supplier_id SET NOT NULL;
    `);
  }
}
