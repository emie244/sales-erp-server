import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCollectionData1776742925000 implements MigrationInterface {
  name = 'AddCollectionData1776742925000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_orders" ADD COLUMN "collection_data" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales_orders" DROP COLUMN "collection_data"
    `);
  }
}
