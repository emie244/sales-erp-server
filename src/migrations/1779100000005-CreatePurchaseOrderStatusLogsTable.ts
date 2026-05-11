import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePurchaseOrderStatusLogsTable1779100000005
  implements MigrationInterface
{
  name = 'CreatePurchaseOrderStatusLogsTable1779100000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchase_order_status_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "purchase_order_id" uuid NOT NULL,
        "from_status" varchar,
        "to_status" varchar NOT NULL,
        "operator_id" uuid,
        "remark" varchar,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_purchase_order_status_logs_order_id"
      ON "purchase_order_status_logs"("purchase_order_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_purchase_order_status_logs_created_at"
      ON "purchase_order_status_logs"("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "purchase_order_status_logs"
    `);
  }
}
