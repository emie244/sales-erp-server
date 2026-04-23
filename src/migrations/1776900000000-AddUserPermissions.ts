import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPermissions1776900000000 implements MigrationInterface {
  name = 'AddUserPermissions1776900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "permissions" jsonb DEFAULT '[]'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "permissions"
    `);
  }
}
