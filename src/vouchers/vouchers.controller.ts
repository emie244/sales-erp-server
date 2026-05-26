import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';

@Controller('vouchers')
export class VouchersController {
  constructor(private readonly service: VouchersService) {}

  @Post()
  create(@Body() dto: CreateVoucherDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sourceType') sourceType?: string,
    @Query('sourceId') sourceId?: string,
  ) {
    return this.service.findAll(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
      { keyword, type, status, dateFrom, dateTo, sourceType, sourceId },
    );
  }

  @Get('by-source/:sourceType/:sourceId')
  findBySource(
    @Param('sourceType') sourceType: string,
    @Param('sourceId') sourceId: string,
  ) {
    return this.service.findBySource(sourceType, sourceId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVoucherDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/post')
  post(@Param('id') id: string) {
    return this.service.post(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
