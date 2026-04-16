import { Controller, Get } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('sales-summary')
  salesSummary() {
    return this.service.salesSummary();
  }

  @Get('payment-collect')
  paymentCollect() {
    return this.service.paymentCollect();
  }

  @Get('rep-achievement')
  repAchievement() {
    return this.service.repAchievement();
  }
}
