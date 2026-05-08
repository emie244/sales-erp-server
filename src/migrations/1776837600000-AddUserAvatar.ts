import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAvatar1776837600000 implements MigrationInterface {
  name = 'AddUserAvatar1776837600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar" varchar(500)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "avatar"
    `);
  }
}
