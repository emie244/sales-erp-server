import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSkuExtraFields1746420000000 implements MigrationInterface {
  name = 'AddSkuExtraFields1746420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_skus" ADD COLUMN "pic" varchar(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_skus" ADD COLUMN "properties_value" varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_skus" ADD COLUMN "category" varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_skus" ADD COLUMN "brand" varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_skus" ADD COLUMN "sale_price" numeric(14,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_skus" ADD COLUMN "cost_price" numeric(14,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_skus" DROP COLUMN "cost_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_skus" DROP COLUMN "sale_price"`,
    );
    await queryRunner.query(`ALTER TABLE "product_skus" DROP COLUMN "brand"`);
    await queryRunner.query(
      `ALTER TABLE "product_skus" DROP COLUMN "category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_skus" DROP COLUMN "properties_value"`,
    );
    await queryRunner.query(`ALTER TABLE "product_skus" DROP COLUMN "pic"`);
  }
}
