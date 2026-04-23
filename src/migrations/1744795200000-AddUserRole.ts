import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRole1744795200000 implements MigrationInterface {
  name = 'AddUserRole1744795200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "role" varchar(50) NOT NULL DEFAULT 'user'`,
    );
    await queryRunner.query(`UPDATE "users" SET "role" = 'admin'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
  }
}
