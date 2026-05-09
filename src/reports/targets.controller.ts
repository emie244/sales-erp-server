import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { TargetsService } from './targets.service';
import { Permissions } from '../auth/permissions.decorator';

@Controller('targets')
export class TargetsController {
  constructor(private readonly service: TargetsService) {}

  @Get()
  findAll(@Query('period') period?: string) {
    return this.service.findAll(period);
  }

  @Get(':userId')
  findByUser(
    @Param('userId') userId: string,
    @Query('period') period?: string,
  ) {
    return this.service.findByUser(userId, period);
  }

  @Permissions('target:manage')
  @Post()
  create(
    @Body()
    dto: {
      userId: string;
      userName?: string;
      targetAmount: number;
      period?: string;
    },
  ) {
    return this.service.create(dto);
  }

  @Permissions('target:manage')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: { targetAmount: number }) {
    return this.service.update(id, dto);
  }

  @Permissions('target:manage')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
