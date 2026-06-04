import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategoryMappingTable implements MigrationInterface {
  name = 'CreateCategoryMappingTable';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE category_mappings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        erp_category VARCHAR(255) NOT NULL UNIQUE,
        jst_category VARCHAR(255) NOT NULL,
        jst_category_id VARCHAR(255),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS category_mappings;`);
  }
}
