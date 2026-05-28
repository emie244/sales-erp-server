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
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Request } from 'express';
import { Permissions } from '../auth/permissions.decorator';
import { Public } from '../auth/public.decorator';
import { UsersService } from './users.service';

@Controller('users')
@Permissions('admin:users')
export class UsersController {
  constructor(
    private readonly service: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  @Permissions() // 允许所有登录用户查看用户列表（用于筛选下拉等场景）
  async findAll(
    @Req() req: Request,
    @Query('keyword') keyword?: string,
    @Query('role') role?: string,
    @Query('sortField') sortField?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    const tenantId = req.user?.tenantId;
    return this.service.findAll(tenantId, keyword, role, sortField, sortOrder);
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
      avatar: user.avatar,
      role: user.role,
      permissions: user.permissions || [],
    };
  }

  @Get('me')
  @Permissions()
  async me(@Req() req: Request) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('未登录');
    const user = await this.service.findOne(userId);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      permissions: user.permissions || [],
      feishuUserId: user.feishuUserId,
      jushuitanShopId: user.jushuitanShopId,
      isFirstLogin: user.isFirstLogin,
    };
  }

  @Put('me')
  @Permissions()
  async updateMe(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('未登录');
    // 禁止通过个人中心修改敏感字段
    delete (body as any).role;
    delete (body as any).permissions;
    delete (body as any).isActive;
    delete (body as any).tenantId;
    delete (body as any).feishuOpenId;
    delete (body as any).feishuUserId;
    delete (body as any).feishuUnionId;
    return this.service.update(userId, body);
  }

  @Get('me/dashboard')
  @Permissions()
  async dashboard(@Req() req: Request) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('未登录');
    const tenantId = req.user?.tenantId;

    // 本月订单统计
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const myOrdersStats = await this.dataSource.query(
      `
      SELECT COUNT(*) as count, COALESCE(SUM("payAmount"), 0) as amount
      FROM sales_orders
      WHERE creator_id = $1 AND created_at >= $2
      ${tenantId ? 'AND tenant_id = $3' : ''}
      `,
      tenantId
        ? [userId, monthStart.toISOString(), tenantId]
        : [userId, monthStart.toISOString()],
    );

    // 待审批统计
    const pendingApprovals = await this.dataSource.query(
      `
      SELECT
        (SELECT COUNT(*) FROM sales_orders WHERE status = 'pending_approval' ${tenantId ? 'AND tenant_id = $2' : ''}) as sales_orders,
        (SELECT COUNT(*) FROM purchase_orders WHERE status = 'pending_approval' ${tenantId ? 'AND tenant_id = $2' : ''}) as purchase_orders,
        (SELECT COUNT(*) FROM purchase_requests WHERE status = 'pending_approval' ${tenantId ? 'AND tenant_id = $2' : ''}) as purchase_requests
      `,
      tenantId ? [userId, tenantId] : []
    );

    // 交期预警
    const deliveryWarnings = await this.dataSource.query(
      `
      SELECT COUNT(*) as count
      FROM sales_orders
      WHERE delivery_warning IS NOT NULL
      ${tenantId ? 'AND tenant_id = $1' : ''}
      `,
      tenantId ? [tenantId] : [],
    );

    // 低库存 SKU
    const lowStock = await this.dataSource.query(
      `
      SELECT COUNT(*) as count
      FROM local_stock_balances
      WHERE qty <= 0
      `
    );

    return {
      myOrdersThisMonth: {
        count: parseInt(myOrdersStats[0]?.count || '0', 10),
        amount: parseFloat(myOrdersStats[0]?.amount || '0'),
      },
      pendingApprovals: {
        salesOrders: parseInt(pendingApprovals[0]?.sales_orders || '0', 10),
        purchaseOrders: parseInt(pendingApprovals[0]?.purchase_orders || '0', 10),
        purchaseRequests: parseInt(pendingApprovals[0]?.purchase_requests || '0', 10),
      },
      deliveryWarnings: parseInt(deliveryWarnings[0]?.count || '0', 10),
      lowStockSkus: parseInt(lowStock[0]?.count || '0', 10),
    };
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    if (!body.name || !body.email) {
      throw new BadRequestException('用户名和邮箱必填');
    }
    return this.service.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const currentUser = req.user;

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
    const currentUser = req.user;
    if (id === currentUser?.userId) {
      throw new BadRequestException('不能删除自己');
    }
    // 软删除：设置 isActive = false
    return this.service.update(id, { isActive: false });
  }
}
