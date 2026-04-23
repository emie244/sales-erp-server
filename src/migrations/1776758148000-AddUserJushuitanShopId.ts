import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserJushuitanShopId1776758148000 implements MigrationInterface {
  name = 'AddUserJushuitanShopId1776758148000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "jushuitan_shop_id" varchar(50)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "jushuitan_shop_id"
    `);
  }
}
