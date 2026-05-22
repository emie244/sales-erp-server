import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase8SalesOrderSchemaAlter1780000000000
  implements MigrationInterface
{
  name = 'Phase8SalesOrderSchemaAlter1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---------- customers ----------
    await queryRunner.query(`
      ALTER TABLE "customers"
        ADD COLUMN IF NOT EXISTS "contact_title" varchar,
        ADD COLUMN IF NOT EXISTS "wechat" varchar,
        ADD COLUMN IF NOT EXISTS "settlement_type" varchar DEFAULT 'one_off',
        ADD COLUMN IF NOT EXISTS "customer_status" varchar DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS "customer_type" varchar DEFAULT 'standard',
        ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "auto_tier" varchar DEFAULT 'new',
        ADD COLUMN IF NOT EXISTS "is_strategic" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "primary_assignee_id" uuid,
        ADD COLUMN IF NOT EXISTS "tax_id" varchar,
        ADD COLUMN IF NOT EXISTS "invoice_title" varchar,
        ADD COLUMN IF NOT EXISTS "invoice_address" varchar,
        ADD COLUMN IF NOT EXISTS "invoice_phone" varchar,
        ADD COLUMN IF NOT EXISTS "invoice_bank" varchar,
        ADD COLUMN IF NOT EXISTS "invoice_bank_account" varchar,
        ADD COLUMN IF NOT EXISTS "jst_customer_id" varchar,
        ADD COLUMN IF NOT EXISTS "feishu_record_id" varchar,
        ADD COLUMN IF NOT EXISTS "migration_source" varchar,
        ADD COLUMN IF NOT EXISTS "latest_remark" text,
        ADD COLUMN IF NOT EXISTS "online_shop_urls" jsonb;
    `);

    await queryRunner.query(`
      ALTER TABLE "customers" DROP COLUMN IF EXISTS "level";
    `);
    await queryRunner.query(`
      ALTER TABLE "customers" DROP COLUMN IF EXISTS "is_active";
    `);

    // ---------- sales_orders ----------
    // Rename signer_id -> salesperson_id (idempotent)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'sales_orders'
            AND column_name = 'signer_id'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'sales_orders'
            AND column_name = 'salesperson_id'
        )
        THEN
          ALTER TABLE "sales_orders" RENAME COLUMN "signer_id" TO "salesperson_id";
        END IF;
      END $$;
    `);

    // Rename FK constraint if exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_name = 'sales_orders'
            AND constraint_name = 'fk_sales_orders_signer'
        )
        THEN
          ALTER TABLE "sales_orders" RENAME CONSTRAINT "fk_sales_orders_signer" TO "fk_sales_orders_salesperson";
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "sales_orders"
        ADD COLUMN IF NOT EXISTS "salesperson_id" uuid,
        ADD COLUMN IF NOT EXISTS "jst_shop_owner_id" uuid,
        ADD COLUMN IF NOT EXISTS "order_no" varchar,
        ADD COLUMN IF NOT EXISTS "feishu_record_id" varchar,
        ADD COLUMN IF NOT EXISTS "migration_source" varchar;
    `);

    // Add unique constraint on order_no
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'ux_sales_orders_order_no'
        )
        THEN
          CREATE UNIQUE INDEX "ux_sales_orders_order_no"
            ON "sales_orders" ("order_no")
            WHERE "order_no" IS NOT NULL;
        END IF;
      END $$;
    `);

    // FK for jst_shop_owner_id
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_name = 'sales_orders'
            AND constraint_name = 'fk_sales_orders_jst_shop_owner'
        )
        THEN
          ALTER TABLE "sales_orders"
            ADD CONSTRAINT "fk_sales_orders_jst_shop_owner"
            FOREIGN KEY ("jst_shop_owner_id")
            REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // ---------- sales_order_items ----------
    await queryRunner.query(`
      ALTER TABLE "sales_order_items"
        ALTER COLUMN "order_id" DROP NOT NULL,
        ALTER COLUMN "sku_id" DROP NOT NULL,
        ALTER COLUMN "sku_name" DROP NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE "sales_order_items"
        ADD COLUMN IF NOT EXISTS "match_method" varchar(16),
        ADD COLUMN IF NOT EXISTS "match_confidence" numeric(3,2),
        ADD COLUMN IF NOT EXISTS "misc_description" varchar,
        ADD COLUMN IF NOT EXISTS "barcode_text" varchar,
        ADD COLUMN IF NOT EXISTS "product_name_text" varchar,
        ADD COLUMN IF NOT EXISTS "spec_text" varchar,
        ADD COLUMN IF NOT EXISTS "feishu_record_id" varchar,
        ADD COLUMN IF NOT EXISTS "orphan_order_no" varchar;
    `);

    // ---------- payment_records ----------
    await queryRunner.query(`
      ALTER TABLE "payment_records"
        ADD COLUMN IF NOT EXISTS "tax_rate" numeric(4,2),
        ADD COLUMN IF NOT EXISTS "tax_amount" numeric(14,2),
        ADD COLUMN IF NOT EXISTS "feishu_record_id" varchar,
        ADD COLUMN IF NOT EXISTS "migration_source" varchar,
        ADD COLUMN IF NOT EXISTS "orphan_order_no" varchar,
        ADD COLUMN IF NOT EXISTS "method_normalized" varchar(32),
        ADD COLUMN IF NOT EXISTS "tax_rate_normalized" numeric(4,2);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ---------- payment_records ----------
    await queryRunner.query(`
      ALTER TABLE "payment_records"
        DROP COLUMN IF EXISTS "tax_rate",
        DROP COLUMN IF EXISTS "tax_amount",
        DROP COLUMN IF EXISTS "feishu_record_id",
        DROP COLUMN IF EXISTS "migration_source",
        DROP COLUMN IF EXISTS "orphan_order_no",
        DROP COLUMN IF EXISTS "method_normalized",
        DROP COLUMN IF EXISTS "tax_rate_normalized";
    `);

    // ---------- sales_order_items ----------
    await queryRunner.query(`
      ALTER TABLE "sales_order_items"
        DROP COLUMN IF EXISTS "match_method",
        DROP COLUMN IF EXISTS "match_confidence",
        DROP COLUMN IF EXISTS "misc_description",
        DROP COLUMN IF EXISTS "barcode_text",
        DROP COLUMN IF EXISTS "product_name_text",
        DROP COLUMN IF EXISTS "spec_text",
        DROP COLUMN IF EXISTS "feishu_record_id",
        DROP COLUMN IF EXISTS "orphan_order_no";
    `);

    // ---------- sales_orders ----------
    await queryRunner.query(`
      ALTER TABLE "sales_orders" DROP CONSTRAINT IF EXISTS "fk_sales_orders_jst_shop_owner";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "ux_sales_orders_order_no";
    `);
    await queryRunner.query(`
      ALTER TABLE "sales_orders"
        DROP COLUMN IF EXISTS "jst_shop_owner_id",
        DROP COLUMN IF EXISTS "order_no",
        DROP COLUMN IF EXISTS "feishu_record_id",
        DROP COLUMN IF EXISTS "migration_source";
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'sales_orders'
            AND column_name = 'salesperson_id'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'sales_orders'
            AND column_name = 'signer_id'
        )
        THEN
          ALTER TABLE "sales_orders" RENAME COLUMN "salesperson_id" TO "signer_id";
        END IF;
      END $$;
    `);

    // ---------- customers ----------
    await queryRunner.query(`
      ALTER TABLE "customers"
        DROP COLUMN IF EXISTS "contact_title",
        DROP COLUMN IF EXISTS "wechat",
        DROP COLUMN IF EXISTS "settlement_type",
        DROP COLUMN IF EXISTS "customer_status",
        DROP COLUMN IF EXISTS "customer_type",
        DROP COLUMN IF EXISTS "tags",
        DROP COLUMN IF EXISTS "auto_tier",
        DROP COLUMN IF EXISTS "is_strategic",
        DROP COLUMN IF EXISTS "primary_assignee_id",
        DROP COLUMN IF EXISTS "tax_id",
        DROP COLUMN IF EXISTS "invoice_title",
        DROP COLUMN IF EXISTS "invoice_address",
        DROP COLUMN IF EXISTS "invoice_phone",
        DROP COLUMN IF EXISTS "invoice_bank",
        DROP COLUMN IF EXISTS "invoice_bank_account",
        DROP COLUMN IF EXISTS "jst_customer_id",
        DROP COLUMN IF EXISTS "feishu_record_id",
        DROP COLUMN IF EXISTS "migration_source",
        DROP COLUMN IF EXISTS "latest_remark",
        DROP COLUMN IF EXISTS "online_shop_urls";
    `);
  }
}
