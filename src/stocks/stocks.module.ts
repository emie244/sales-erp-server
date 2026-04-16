import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockSnapshot } from './entities/stock-snapshot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StockSnapshot])],
  exports: [TypeOrmModule],
})
export class StocksModule {}
