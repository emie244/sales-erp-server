import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { StockSnapshot } from './entities/stock-snapshot.entity';
import { StockLedger } from './entities/stock-ledger.entity';
import { LocalStockBalance } from './entities/local-stock-balance.entity';
import { StockReservation } from './entities/stock-reservation.entity';
import { StocksService } from './stocks.service';
import { StockLedgerService } from './stock-ledger.service';
import { StockReservationsService } from './stock-reservations.service';
import { StocksController } from './stocks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([StockSnapshot, StockLedger, LocalStockBalance, StockReservation]),
    BullModule.registerQueue({ name: 'jushuitan-sync' }),
  ],
  controllers: [StocksController],
  providers: [StocksService, StockLedgerService, StockReservationsService],
  exports: [StocksService, StockLedgerService, StockReservationsService],
})
export class StocksModule {}
