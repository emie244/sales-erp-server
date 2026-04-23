import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserFeishuIds1744802400000 implements MigrationInterface {
  name = 'AddUserFeishuIds1744802400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "feishu_user_id" varchar(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "feishu_union_id" varchar(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "feishu_union_id"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "feishu_user_id"`);
  }
}
