import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { StockSnapshot } from './entities/stock-snapshot.entity';
import { StocksService } from './stocks.service';
import { StocksController } from './stocks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([StockSnapshot]),
    BullModule.registerQueue({ name: 'jushuitan-sync' }),
  ],
  controllers: [StocksController],
  providers: [StocksService],
  exports: [StocksService],
})
export class StocksModule {}
