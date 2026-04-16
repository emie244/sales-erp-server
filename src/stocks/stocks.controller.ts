import { Controller, Get, Param } from '@nestjs/common';
import { StocksService } from './stocks.service';

@Controller('stocks')
export class StocksController {
  constructor(private readonly service: StocksService) {}

  @Get(':skuId')
  findBySku(@Param('skuId') skuId: string) {
    return this.service.findBySku(skuId);
  }
}
