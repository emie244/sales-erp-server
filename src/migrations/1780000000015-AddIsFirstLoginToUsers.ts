import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsFirstLoginToUsers1780000000015 implements MigrationInterface {
  name = 'AddIsFirstLoginToUsers1780000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT true;
    `);
    // 已有用户默认不是首次登录
    await queryRunner.query(`
      UPDATE users SET is_first_login = false WHERE is_first_login IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS is_first_login;
    `);
  }
}
