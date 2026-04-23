import { Controller, Get, Post, Put, Body, Param, Delete } from '@nestjs/common';
import { Permissions } from '../auth/permissions.decorator';
import { TenantsService } from './tenants.service';

@Controller('tenants')
@Permissions('admin:users')
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
