import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceAndPaymentDueDate1780000000008
  implements MigrationInterface
{
  name = 'AddInvoiceAndPaymentDueDate1780000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sales_orders
        ADD COLUMN invoice_date date,
        ADD COLUMN payment_due_date date,
        ADD COLUMN invoiced_amount decimal(14,2) NOT NULL DEFAULT 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sales_orders
        DROP COLUMN invoice_date,
        DROP COLUMN payment_due_date,
        DROP COLUMN invoiced_amount;
    `);
  }
}
