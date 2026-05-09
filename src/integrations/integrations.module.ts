import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { IntegrationLog } from './entities/integration-log.entity';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { DeliveryOrder } from '../deliveries/entities/delivery-order.entity';
import { DeliveryOrderItem } from '../deliveries/entities/delivery-order-item.entity';
import { JushuitanService } from './jushuitan.service';
import { JushuitanSyncProcessor } from './jushuitan-sync.processor';
import { JushuitanScheduler } from './jushuitan-scheduler.service';
import { FeishuMessageService } from './feishu-message.service';
import { StocksModule } from '../stocks/stocks.module';
import { ProductsModule } from '../products/products.module';
import { BomsModule } from '../boms/boms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntegrationLog,
      SalesOrder,
      DeliveryOrder,
      DeliveryOrderItem,
    ]),
    BullModule.registerQueue({ name: 'jushuitan-sync' }),
    StocksModule,
    ProductsModule,
    BomsModule,
  ],
  providers: [
    JushuitanService,
    JushuitanSyncProcessor,
    JushuitanScheduler,
    FeishuMessageService,
  ],
  exports: [JushuitanService, FeishuMessageService],
})
export class IntegrationsModule {}
