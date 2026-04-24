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
  ForbiddenException,
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
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const currentUser = (req as any).user;

    // 禁止用户修改自己的角色或权限（防止管理员误操作或权限绕过）
    if (id === currentUser?.userId) {
      delete body.role;
      delete body.permissions;
      delete body.isActive;
      delete body.tenantId;
    }

    // 只有管理员可以修改角色、权限等敏感字段
    if (currentUser?.role !== 'admin') {
      const sensitiveFields = ['role', 'permissions', 'isActive', 'tenantId'];
      for (const field of sensitiveFields) {
        if (field in body) {
          throw new ForbiddenException(`无权修改字段: ${field}`);
        }
      }
    }

    return this.service.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    const currentUser = (req as any).user;
    if (id === currentUser?.userId) {
      throw new BadRequestException('不能删除自己');
    }
    // 软删除：设置 isActive = false
    return this.service.update(id, { isActive: false });
  }
}
