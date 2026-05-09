import { Controller, Get, Query, Request } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { ReportsService, ReportUser } from './reports.service';
import { Permissions } from '../auth/permissions.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  private extractUser(req: ExpressRequest): ReportUser {
    const user = req.user;
    return {
      userId: user?.userId || '',
      role: user?.role || '',
      permissions: user?.permissions || [],
    };
  }

  @Permissions('report:view')
  @Get('sales-summary')
  salesSummary(
    @Request() req: ExpressRequest,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('signerId') signerId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.salesSummary(this.extractUser(req), {
      dateFrom,
      dateTo,
      signerId,
      status,
    });
  }

  @Permissions('report:view')
  @Get('total-order-amount')
  totalOrderAmount(
    @Request() req: ExpressRequest,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('signerId') signerId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.totalOrderAmount(this.extractUser(req), {
      dateFrom,
      dateTo,
      signerId,
      status,
    });
  }

  @Permissions('report:view')
  @Get('payment-collect')
  paymentCollect(
    @Request() req: ExpressRequest,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.paymentCollect(this.extractUser(req), {
      dateFrom,
      dateTo,
    });
  }

  @Permissions('report:view')
  @Get('total-collected-amount')
  totalCollectedAmount(
    @Request() req: ExpressRequest,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.totalCollectedAmount(this.extractUser(req), {
      dateFrom,
      dateTo,
    });
  }

  @Permissions('report:view')
  @Get('payment-records')
  paymentRecords(
    @Request() req: ExpressRequest,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.paymentRecords(this.extractUser(req), {
      dateFrom,
      dateTo,
    });
  }

  @Permissions('report:view')
  @Get('rep-achievement')
  repAchievement(@Request() req: ExpressRequest) {
    return this.service.repAchievement(this.extractUser(req));
  }

  @Permissions('report:view')
  @Get('signer-ranking')
  signerRanking(
    @Request() req: ExpressRequest,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.signerRanking(this.extractUser(req), {
      dateFrom,
      dateTo,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Permissions('report:view')
  @Get('product-ranking')
  productRanking(
    @Request() req: ExpressRequest,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.productRanking(this.extractUser(req), {
      dateFrom,
      dateTo,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Permissions('report:view')
  @Get('target-progress')
  targetProgress(
    @Request() req: ExpressRequest,
    @Query('period') period?: string,
  ) {
    return this.service.targetProgress(this.extractUser(req), period);
  }

  @Permissions('report:view')
  @Get('dashboard-stats')
  dashboardStats(@Request() req: ExpressRequest) {
    return this.service.dashboardStats(this.extractUser(req));
  }
}
