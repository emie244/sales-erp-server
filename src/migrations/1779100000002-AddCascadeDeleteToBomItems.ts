import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCascadeDeleteToBomItems1779100000002
  implements MigrationInterface
{
  name = 'AddCascadeDeleteToBomItems1779100000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 删除旧的外键约束
    await queryRunner.query(`
      ALTER TABLE bom_items
      DROP CONSTRAINT IF EXISTS "FK_854fdedd1e463ba2031f4aa36d1"
    `);

    // 添加带 ON DELETE CASCADE 的新外键约束
    await queryRunner.query(`
      ALTER TABLE bom_items
      ADD CONSTRAINT "FK_bom_items_bom_header"
      FOREIGN KEY (bom_header_id) REFERENCES bom_headers(id)
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE bom_items
      DROP CONSTRAINT IF EXISTS "FK_bom_items_bom_header"
    `);

    await queryRunner.query(`
      ALTER TABLE bom_items
      ADD CONSTRAINT "FK_854fdedd1e463ba2031f4aa36d1"
      FOREIGN KEY (bom_header_id) REFERENCES bom_headers(id)
    `);
  }
}
