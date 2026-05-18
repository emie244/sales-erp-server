import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLocalPicToProductSkus1779100000008 implements MigrationInterface {
  name = 'AddLocalPicToProductSkus1779100000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE product_skus ADD COLUMN IF NOT EXISTS local_pic varchar(500);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE product_skus DROP COLUMN IF EXISTS local_pic;
    `);
  }
}
