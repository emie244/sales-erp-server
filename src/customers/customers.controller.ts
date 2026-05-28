import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Permissions } from '../auth/permissions.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CheckDuplicateDto } from './dto/check-duplicate.dto';
import { ExportService } from '../common/services/export.service';

@Controller('customers')
export class CustomersController {
  constructor(
    private readonly service: CustomersService,
    private readonly exportService: ExportService,
  ) {}

  @Post()
  @Permissions('customer:create')
  create(@Body() dto: CreateCustomerDto, @Req() req: Request) {
    const tenantId = req.user?.tenantId;
    return this.service.create(dto, tenantId);
  }

  @Get()
  @Permissions('customer:view')
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
    @Query('customerStatus') customerStatus: string | string[] | undefined,
    @Query('autoTier') autoTier: string | string[] | undefined,
    @Query('primaryAssigneeId') primaryAssigneeId: string | undefined,
    @Query('tag') tag: string | undefined,
    @Query('reviewNeeded') reviewNeeded: string | undefined,
    @Query('keyword') keyword: string | undefined,
    @Req() req: Request,
  ) {
    const tenantId = req.user?.tenantId;
    return this.service.findAll(page, pageSize, tenantId, {
      customerStatus,
      autoTier,
      primaryAssigneeId,
      tag,
      reviewNeeded: reviewNeeded === 'true' || reviewNeeded === '1',
      keyword,
    });
  }

  @Get('export')
  @Permissions('customer:view')
  async export(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tenantId = req.user?.tenantId;
    const { data } = await this.service.findAll(1, 10000, tenantId);

    const columns = [
      { header: '客户名称', key: 'name', width: 25 },
      { header: '联系人', key: 'contactName', width: 15 },
      { header: '电话', key: 'phone', width: 18 },
      { header: '客户类型', key: 'customerType', width: 14 },
      { header: '自动分层', key: 'autoTier', width: 12 },
      { header: '信用额度', key: 'creditLimit', width: 15 },
      { header: '账期(天)', key: 'paymentTerms', width: 12 },
      { header: '地址', key: 'address', width: 40 },
      { header: '预付款余额', key: 'prepaymentBalance', width: 15 },
      {
        header: '状态',
        key: 'customerStatus',
        width: 12,
        formatter: (v: unknown) => {
          if (v === 'active') return '合作中';
          if (v === 'lead') return '潜在客户';
          if (v === 'dormant') return '已休眠';
          return String(v ?? '');
        },
      },
      { header: '创建时间', key: 'createdAt', width: 20 },
    ];

    const buffer = await this.exportService.exportToExcel(
      data,
      columns,
      '客户列表',
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    });

    return buffer;
  }

  @Get(':id')
  @Permissions('customer:view')
  findOne(
    @Param('id') id: string,
    @Query('withAddresses') withAddresses?: string,
  ) {
    return this.service.findOne(id, withAddresses === 'true');
  }

  @Put(':id')
  @Permissions('customer:edit')
  update(@Param('id') id: string, @Body() dto: CreateCustomerDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions('customer:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('batch')
  @Permissions('customer:create')
  async batchCreate(
    @Body() body: { customers: CreateCustomerDto[] },
    @Req() req: Request,
  ) {
    if (
      !body.customers ||
      !Array.isArray(body.customers) ||
      body.customers.length === 0
    ) {
      throw new BadRequestException('customers 必须为非空数组');
    }
    const tenantId = req.user?.tenantId;
    return this.service.batchCreate(body.customers, tenantId);
  }

  @Post('check-duplicates')
  @Permissions('customer:view')
  checkDuplicates(@Body() dto: CheckDuplicateDto, @Req() req: Request) {
    const tenantId = req.user?.tenantId;
    return this.service.checkDuplicates(dto, tenantId);
  }

  @Get(':id/orders')
  findOrders(@Param('id') _id: string) {
    return [];
  }
}
