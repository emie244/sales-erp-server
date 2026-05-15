import { Module } from '@nestjs/common';
import type { ServerResponse } from 'http';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { APP_INTERCEPTOR, APP_FILTER, APP_GUARD } from '@nestjs/core';
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import {
  HttpExceptionFilter,
  AllExceptionsFilter,
} from './common/filters/http-exception.filter';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { StocksModule } from './stocks/stocks.module';
import { PaymentsModule } from './payments/payments.module';
import { PrepaymentsModule } from './prepayments/prepayments.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { AchievementsModule } from './achievements/achievements.module';
import { ReportsModule } from './reports/reports.module';
import { OperationLogsModule } from './operation-logs/operation-logs.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';
import { OperationLogInterceptor } from './operation-logs/operation-log.interceptor';
import { TenantsModule } from './tenants/tenants.module';
import { CustomerAddressesModule } from './customer-addresses/customer-addresses.module';
import { BomsModule } from './boms/boms.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { ProductionOrdersModule } from './production-orders/production-orders.module';
import { MaterialCategoriesModule } from './material-categories/material-categories.module';
import { UploadController } from './common/controllers/upload.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get('database')!,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: config.get('redis')!,
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: 'jushuitan-sync' }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'web', 'dist'),
      exclude: ['/api/{*path}'],
      serveStaticOptions: {
        setHeaders: (res: ServerResponse, path: string) => {
          if (path.endsWith('.html')) {
            res.setHeader(
              'Cache-Control',
              'no-cache, no-store, must-revalidate',
            );
          }
        },
      },
    }),
    UsersModule,
    CustomersModule,
    ProductsModule,
    SalesModule,
    ApprovalsModule,
    IntegrationsModule,
    StocksModule,
    PaymentsModule,
    PrepaymentsModule,
    DeliveriesModule,
    AchievementsModule,
    ReportsModule,
    OperationLogsModule,
    AuthModule,
    TenantsModule,
    CustomerAddressesModule,
    BomsModule,
    SuppliersModule,
    PurchaseOrdersModule,
    ProductionOrdersModule,
    MaterialCategoriesModule,
  ],
  controllers: [UploadController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: OperationLogInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
