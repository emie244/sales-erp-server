import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('sales-summary')
  salesSummary(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('signerId') signerId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.salesSummary({ dateFrom, dateTo, signerId, status });
  }

  @Get('total-order-amount')
  totalOrderAmount(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('signerId') signerId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.totalOrderAmount({ dateFrom, dateTo, signerId, status });
  }

  @Get('payment-collect')
  paymentCollect(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.paymentCollect({ dateFrom, dateTo });
  }

  @Get('total-collected-amount')
  totalCollectedAmount(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.totalCollectedAmount({ dateFrom, dateTo });
  }

  @Get('rep-achievement')
  repAchievement() {
    return this.service.repAchievement();
  }

  @Get('signer-ranking')
  signerRanking(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.signerRanking({
      dateFrom,
      dateTo,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('product-ranking')
  productRanking(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.productRanking({
      dateFrom,
      dateTo,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('target-progress')
  targetProgress(@Query('period') period?: string) {
    return this.service.targetProgress(period);
  }
}
