import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationTable implements MigrationInterface {
  name = 'CreateNotificationTable';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id VARCHAR(64) NOT NULL,
        type VARCHAR(32) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        related_id VARCHAR(64),
        is_read BOOLEAN NOT NULL DEFAULT false,
        read_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notifications;`);
  }
}
