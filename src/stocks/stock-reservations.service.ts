import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  StockReservation,
  StockReservationStatus,
} from './entities/stock-reservation.entity';

@Injectable()
export class StockReservationsService {
  constructor(
    @InjectRepository(StockReservation)
    private readonly repo: Repository<StockReservation>,
  ) {}

  async reserve(
    salesOrderId: string,
    skuId: string,
    qty: number,
  ): Promise<StockReservation> {
    const reservation = this.repo.create({
      salesOrderId,
      skuId,
      qty,
      status: StockReservationStatus.ACTIVE,
    });
    return this.repo.save(reservation);
  }

  async releaseBySalesOrder(salesOrderId: string): Promise<void> {
    await this.repo.update(
      { salesOrderId, status: StockReservationStatus.ACTIVE },
      { status: StockReservationStatus.RELEASED },
    );
  }

  async releaseById(id: string): Promise<void> {
    await this.repo.update(
      { id },
      { status: StockReservationStatus.RELEASED },
    );
  }

  async getReservedQty(skuId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.qty), 0)', 'total')
      .where('r.skuId = :skuId', { skuId })
      .andWhere('r.status = :status', { status: StockReservationStatus.ACTIVE })
      .getRawOne();
    return parseFloat(result?.total || '0');
  }

  async findActiveBySalesOrder(
    salesOrderId: string,
  ): Promise<StockReservation[]> {
    return this.repo.find({
      where: { salesOrderId, status: StockReservationStatus.ACTIVE },
    });
  }
}
