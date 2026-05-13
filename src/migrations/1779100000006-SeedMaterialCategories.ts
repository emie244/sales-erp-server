import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedMaterialCategories1779100000006 implements MigrationInterface {
  name = 'SeedMaterialCategories1779100000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO material_categories (id, code, name, parent_id, level, sort_order, is_active, created_at, updated_at)
      VALUES
        (gen_random_uuid(), 'BZ', '包装', NULL, 1, 0, true, NOW(), NOW()),
        (gen_random_uuid(), 'PJ', '配件', NULL, 1, 1, true, NOW(), NOW()),
        (gen_random_uuid(), 'LJ', '裸机', NULL, 1, 2, true, NOW(), NOW())
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM material_categories WHERE code IN ('BZ', 'PJ', 'LJ');
    `);
  }
}
