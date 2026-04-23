import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordToUsers1776842753000 implements MigrationInterface {
  name = 'AddPasswordToUsers1776842753000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "password" character varying
    `);

    // 为现有用户设置默认密码（用户名），方便首次登录
    await queryRunner.query(`
      UPDATE "users" 
      SET "password" = "name" 
      WHERE "password" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "password"
    `);
  }
}
