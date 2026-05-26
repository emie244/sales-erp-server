import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpectedDeliveryDateToPurchaseOrder1780000000010
  implements MigrationInterface
{
  name = 'AddExpectedDeliveryDateToPurchaseOrder1780000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE purchase_orders
        ADD COLUMN expected_delivery_date date;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE purchase_orders
        DROP COLUMN expected_delivery_date;
    `);
  }
}
