import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum StockReservationStatus {
  ACTIVE = 'active',
  RELEASED = 'released',
}

@Entity('stock_reservations')
@Index(['skuId', 'status'])
@Index(['salesOrderId'])
export class StockReservation extends BaseEntity {
  @Column({ name: 'sku_id' })
  skuId: string;

  @Column({ name: 'sales_order_id' })
  salesOrderId: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  qty: number;

  @Column({
    type: 'enum',
    enum: StockReservationStatus,
    default: StockReservationStatus.ACTIVE,
  })
  status: StockReservationStatus;
}
