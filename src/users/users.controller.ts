import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Put,
  Delete,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Permissions } from '../auth/permissions.decorator';
import { UsersService } from './users.service';

@Controller('users')
@Permissions('admin:users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  async findAll(@Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.service.findAll(tenantId);
  }

  @Get('profile')
  @Permissions() // 不需要权限，用于登录时获取信息
  async profile(@Query('name') name: string) {
    const user = await this.service.findByName(name);
    if (!user) return { feishuOpenId: null };
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      feishuOpenId: user.feishuOpenId,
      feishuUserId: user.feishuUserId,
      feishuUnionId: user.feishuUnionId,
      role: user.role,
      permissions: user.permissions || [],
    };
  }

  @Post()
  async create(@Body() body: any) {
    if (!body.name || !body.email) {
      throw new BadRequestException('用户名和邮箱必填');
    }
    return this.service.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    // 软删除：设置 isActive = false
    return this.service.update(id, { isActive: false });
  }
}
