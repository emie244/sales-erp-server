import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderSignerAndAttachments1744798800000 implements MigrationInterface {
  name = 'AddOrderSignerAndAttachments1744798800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD COLUMN "signer_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD COLUMN "attachments" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" ADD CONSTRAINT "fk_sales_orders_signer" FOREIGN KEY ("signer_id") REFERENCES "users"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales_orders" DROP CONSTRAINT "fk_sales_orders_signer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" DROP COLUMN "attachments"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_orders" DROP COLUMN "signer_id"`,
    );
  }
}
