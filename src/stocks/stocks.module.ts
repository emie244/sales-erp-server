import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { StockSnapshot } from './entities/stock-snapshot.entity';
import { StockLedger } from './entities/stock-ledger.entity';
import { LocalStockBalance } from './entities/local-stock-balance.entity';
import { StocksService } from './stocks.service';
import { StockLedgerService } from './stock-ledger.service';
import { StocksController } from './stocks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([StockSnapshot, StockLedger, LocalStockBalance]),
    BullModule.registerQueue({ name: 'jushuitan-sync' }),
  ],
  controllers: [StocksController],
  providers: [StocksService, StockLedgerService],
  exports: [StocksService, StockLedgerService],
})
export class StocksModule {}
