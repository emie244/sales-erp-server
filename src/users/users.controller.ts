import { Controller, Get, Post, Body, Param, Query, Put } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  async findAll() {
    return this.service.findAll();
  }

  @Get('profile')
  async profile(@Query('name') name: string) {
    const user = await this.service.findByName(name);
    if (!user) return { feishuOpenId: null };
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      feishuOpenId: user.feishuOpenId,
    };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }
}
