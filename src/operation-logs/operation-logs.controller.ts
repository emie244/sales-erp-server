import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
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
  ) {
    return this.service.findAll(page, pageSize);
  }
}
