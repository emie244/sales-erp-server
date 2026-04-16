import { registerAs } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';

export const databaseConfig = registerAs('database', () => ({
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'sales_erp',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize:
    process.env.DB_SYNC === 'true' || process.env.NODE_ENV !== 'production',
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  migrationsRun: true,
}));

export const connectionSource = new DataSource(
  databaseConfig() as DataSourceOptions,
);
