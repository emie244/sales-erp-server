import {
  Controller,
  Get,
  Query,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { Permissions } from '../auth/permissions.decorator';
import { OperationLogsService } from './operation-logs.service';

@Controller('operation-logs')
@Permissions('admin:users')
export class OperationLogsController {
  constructor(private readonly service: OperationLogsService) {}

  @Get()
  findAll(
    @Req() req: Request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(50), ParseIntPipe) pageSize: number,
    @Query('userName') userName?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const tenantId = req.user?.tenantId;
    return this.service.findAll(page, pageSize, {
      tenantId,
      userName,
      action,
      resource,
      status,
      dateFrom,
      dateTo,
    });
  }
}
