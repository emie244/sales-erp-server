import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignMaterialCategorySeed1780000000005
  implements MigrationInterface
{
  name = 'AlignMaterialCategorySeed1780000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "material_categories" SET "code" = 'BC' WHERE "code" = 'BCP' AND "level" = 1
    `);
    await queryRunner.query(`
      UPDATE "material_categories" SET "code" = 'YL' WHERE "code" = 'YCL' AND "level" = 1
    `);

    await queryRunner.query(`
      DELETE FROM "material_categories"
      WHERE "level" = 2 AND "code" IN ('BZ', 'PJ', 'LJ', 'DZ', 'SL')
    `);

    await queryRunner.query(`
      INSERT INTO "material_categories" (id, code, name, parent_id, level, sort_order, is_active, created_at, updated_at)
      VALUES
        (gen_random_uuid(), 'CP', '成品', NULL, 1, 0, true, NOW(), NOW()),
        (gen_random_uuid(), 'BC', '半成品', NULL, 1, 1, true, NOW(), NOW()),
        (gen_random_uuid(), 'YL', '原材料', NULL, 1, 2, true, NOW(), NOW())
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "material_categories" SET "code" = 'BCP' WHERE "code" = 'BC' AND "level" = 1
    `);
    await queryRunner.query(`
      UPDATE "material_categories" SET "code" = 'YCL' WHERE "code" = 'YL' AND "level" = 1
    `);
  }
}
