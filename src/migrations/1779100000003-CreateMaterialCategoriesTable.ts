import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMaterialCategoriesTable1779100000003
  implements MigrationInterface
{
  name = 'CreateMaterialCategoriesTable1779100000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "material_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "parent_id" uuid,
        "level" integer NOT NULL DEFAULT 1,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_material_categories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_material_categories_parent"
          FOREIGN KEY ("parent_id") REFERENCES "material_categories"("id")
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_material_categories_parent_id"
        ON "material_categories"("parent_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "material_categories"`);
  }
}
