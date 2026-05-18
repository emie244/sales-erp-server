import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaterialCategoryToBomItems1779100000009 implements MigrationInterface {
  name = 'AddMaterialCategoryToBomItems1779100000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS material_category_id uuid;
    `);
    await queryRunner.query(`
      ALTER TABLE bom_items ADD COLUMN IF NOT EXISTS material_category_name varchar(255);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bom_items DROP COLUMN IF EXISTS material_category_id;
    `);
    await queryRunner.query(`
      ALTER TABLE bom_items DROP COLUMN IF EXISTS material_category_name;
    `);
  }
}
