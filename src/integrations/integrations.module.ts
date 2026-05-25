import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { IntegrationLog } from './entities/integration-log.entity';
import { SyncLog } from './entities/sync-log.entity';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { DeliveryOrder } from '../deliveries/entities/delivery-order.entity';
import { DeliveryOrderItem } from '../deliveries/entities/delivery-order-item.entity';
import { JushuitanService } from './jushuitan.service';
import { JushuitanSyncProcessor } from './jushuitan-sync.processor';
import { JushuitanScheduler } from './jushuitan-scheduler.service';
import { FeishuMessageService } from './feishu-message.service';
import { SyncLogService } from './sync-log.service';
import { SyncLogController } from './sync-log.controller';
import { StocksModule } from '../stocks/stocks.module';
import { ProductsModule } from '../products/products.module';
import { BomsModule } from '../boms/boms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntegrationLog,
      SyncLog,
      SalesOrder,
      DeliveryOrder,
      DeliveryOrderItem,
    ]),
    BullModule.registerQueue({ name: 'jushuitan-sync' }),
    StocksModule,
    ProductsModule,
    BomsModule,
  ],
  controllers: [SyncLogController],
  providers: [
    JushuitanService,
    JushuitanSyncProcessor,
    JushuitanScheduler,
    FeishuMessageService,
    SyncLogService,
  ],
  exports: [JushuitanService, FeishuMessageService, SyncLogService],
})
export class IntegrationsModule {}
