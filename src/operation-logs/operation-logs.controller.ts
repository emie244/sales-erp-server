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
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(50), ParseIntPipe) pageSize: number,
    @Req() req: Request,
  ) {
    const tenantId = (req as any).user?.tenantId;
    return this.service.findAll(page, pageSize, tenantId);
  }
}
