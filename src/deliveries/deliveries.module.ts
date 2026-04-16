import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryOrder } from './entities/delivery-order.entity';
import { DeliveryOrderItem } from './entities/delivery-order-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryOrder, DeliveryOrderItem])],
  exports: [TypeOrmModule],
})
export class DeliveriesModule {}
