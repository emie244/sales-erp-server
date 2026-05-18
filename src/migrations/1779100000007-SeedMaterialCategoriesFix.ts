import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedMaterialCategoriesFix1779100000007 implements MigrationInterface {
  name = 'SeedMaterialCategoriesFix1779100000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 一级分类
    await queryRunner.query(`
      INSERT INTO material_categories (id, code, name, parent_id, level, sort_order, is_active, created_at, updated_at)
      VALUES
        (gen_random_uuid(), 'CP', '成品', NULL, 1, 0, true, NOW(), NOW()),
        (gen_random_uuid(), 'BCP', '半成品', NULL, 1, 1, true, NOW(), NOW()),
        (gen_random_uuid(), 'YCL', '原材料', NULL, 1, 2, true, NOW(), NOW())
      ON CONFLICT DO NOTHING;
    `);

    // 半成品子分类
    await queryRunner.query(`
      INSERT INTO material_categories (id, code, name, parent_id, level, sort_order, is_active, created_at, updated_at)
      SELECT gen_random_uuid(), 'BZ', '包装', id, 2, 0, true, NOW(), NOW()
      FROM material_categories WHERE code = 'BCP' AND level = 1
      ON CONFLICT DO NOTHING;
    `);
    await queryRunner.query(`
      INSERT INTO material_categories (id, code, name, parent_id, level, sort_order, is_active, created_at, updated_at)
      SELECT gen_random_uuid(), 'PJ', '配件', id, 2, 1, true, NOW(), NOW()
      FROM material_categories WHERE code = 'BCP' AND level = 1
      ON CONFLICT DO NOTHING;
    `);
    await queryRunner.query(`
      INSERT INTO material_categories (id, code, name, parent_id, level, sort_order, is_active, created_at, updated_at)
      SELECT gen_random_uuid(), 'LJ', '裸机', id, 2, 2, true, NOW(), NOW()
      FROM material_categories WHERE code = 'BCP' AND level = 1
      ON CONFLICT DO NOTHING;
    `);

    // 原材料子分类
    await queryRunner.query(`
      INSERT INTO material_categories (id, code, name, parent_id, level, sort_order, is_active, created_at, updated_at)
      SELECT gen_random_uuid(), 'DZ', '电子元件', id, 2, 0, true, NOW(), NOW()
      FROM material_categories WHERE code = 'YCL' AND level = 1
      ON CONFLICT DO NOTHING;
    `);
    await queryRunner.query(`
      INSERT INTO material_categories (id, code, name, parent_id, level, sort_order, is_active, created_at, updated_at)
      SELECT gen_random_uuid(), 'SL', '塑料/硅胶', id, 2, 1, true, NOW(), NOW()
      FROM material_categories WHERE code = 'YCL' AND level = 1
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM material_categories WHERE code IN ('CP', 'BCP', 'YCL', 'BZ', 'PJ', 'LJ', 'DZ', 'SL');
    `);
  }
}
