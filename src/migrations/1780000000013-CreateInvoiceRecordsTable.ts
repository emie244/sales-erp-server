import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInvoiceRecordsTable1780000000013
  implements MigrationInterface
{
  name = 'CreateInvoiceRecordsTable1780000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE invoice_status_enum AS ENUM ('draft', 'issued', 'cancelled');
    `);

    await queryRunner.query(`
      CREATE TABLE invoice_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_no VARCHAR(255) NOT NULL,
        sales_order_id UUID,
        amount DECIMAL(14,2) NOT NULL,
        invoice_date DATE NOT NULL,
        status invoice_status_enum DEFAULT 'draft',
        issuer VARCHAR(255),
        remark TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_invoice_records_sales_order_id ON invoice_records(sales_order_id);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_invoice_records_invoice_no ON invoice_records(invoice_no);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS invoice_records;`);
    await queryRunner.query(`DROP TYPE IF EXISTS invoice_status_enum;`);
  }
}
