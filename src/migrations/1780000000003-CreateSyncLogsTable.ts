import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSyncLogsTable1780000000003 implements MigrationInterface {
  name = 'CreateSyncLogsTable1780000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sync_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "job_name" varchar(32) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'running',
        "started_at" timestamptz NOT NULL DEFAULT now(),
        "finished_at" timestamptz,
        "fetched_count" integer NOT NULL DEFAULT 0,
        "inserted_count" integer NOT NULL DEFAULT 0,
        "updated_count" integer NOT NULL DEFAULT 0,
        "skipped_count" integer NOT NULL DEFAULT 0,
        "item_type_null_count" integer NOT NULL DEFAULT 0,
        "code_non_compliant_count" integer NOT NULL DEFAULT 0,
        "errors" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "triggered_by" varchar(16) NOT NULL DEFAULT 'cron',
        "triggered_by_user_id" uuid,
        "bull_job_id" varchar(64),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sync_logs_job_name_started_at"
      ON "sync_logs"("job_name", "started_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sync_logs_status"
      ON "sync_logs"("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_sync_logs_started_at"
      ON "sync_logs"("started_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sync_logs"`);
  }
}
