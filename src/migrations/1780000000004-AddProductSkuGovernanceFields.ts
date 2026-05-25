import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductSkuGovernanceFields1780000000004 implements MigrationInterface {
  name = 'AddProductSkuGovernanceFields1780000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "product_skus"
      ADD COLUMN IF NOT EXISTS "item_type" varchar(16),
      ADD COLUMN IF NOT EXISTS "material_category_id" uuid,
      ADD COLUMN IF NOT EXISTS "material_category_name" varchar(255),
      ADD COLUMN IF NOT EXISTS "code_compliant" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "product_skus"
      ADD CONSTRAINT "FK_product_skus_material_category"
      FOREIGN KEY ("material_category_id")
      REFERENCES "material_categories"("id")
      ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_skus_material_category_id"
      ON "product_skus"("material_category_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_skus_code_compliant"
      ON "product_skus"("code_compliant")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_skus_item_type"
      ON "product_skus"("item_type")
    `);

    await queryRunner.query(`
      UPDATE "product_skus"
      SET "code_compliant" = ("skuCode" ~ '^(CP|BC|YL)-[A-Z]{2}(-[A-Z]{2})?-[0-9]{3}$')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_skus_item_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_skus_code_compliant"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_skus_material_category_id"`,
    );
    await queryRunner.query(`
      ALTER TABLE "product_skus"
      DROP CONSTRAINT IF EXISTS "FK_product_skus_material_category"
    `);
    await queryRunner.query(`
      ALTER TABLE "product_skus"
      DROP COLUMN IF EXISTS "code_compliant",
      DROP COLUMN IF EXISTS "material_category_name",
      DROP COLUMN IF EXISTS "material_category_id",
      DROP COLUMN IF EXISTS "item_type"
    `);
  }
}
