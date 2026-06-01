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
import { getDefaultPermissionsForRole } from '../auth/role-permissions';

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
    // 只允许更新白名单字段，防止意外触发唯一约束等副作用
    const allowed = ['name', 'phone', 'avatar', 'password', 'isFirstLogin'];
    const safeBody: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) safeBody[key] = body[key];
    }
    return this.service.update(userId, safeBody);
  }

  @Get('me/dashboard')
  @Permissions()
  async dashboard(@Req() req: Request) {
    const userId = req.user?.userId;
    const role = req.user?.role;
    if (!userId) throw new BadRequestException('未登录');
    const tenantId = req.user?.tenantId;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const kpis: { key: string; label: string; value: number; suffix?: string; color?: string; link?: string }[] = [];
    const pendingItems: { id: string; title: string; description?: string; status?: string; tag?: string; link?: string }[] = [];

    // 辅助方法：将 tenant_id 和 creator_id 作为参数化条件追加到 SQL 和参数数组
    const withParams = (
      sql: string,
      params: unknown[],
      filters: { userId?: string; tenantId?: string },
    ): [string, unknown[]] => {
      let s = sql;
      const p = [...params];
      if (filters.userId) {
        p.push(filters.userId);
        s += ` AND creator_id = $${p.length}`;
      }
      if (filters.tenantId) {
        p.push(filters.tenantId);
        s += ` AND tenant_id = $${p.length}`;
      }
      return [s, p];
    };

    if (role === 'admin') {
      // Admin KPIs
      const [todayOrdersSql, todayOrdersParams] = withParams(
        `SELECT COUNT(*) as count, COALESCE(SUM("payAmount"), 0) as amount FROM sales_orders WHERE created_at >= $1`,
        [todayStart.toISOString()],
        { tenantId },
      );
      const todayOrders = await this.dataSource.query(todayOrdersSql, todayOrdersParams);

      const [pendingApprovalSql] = withParams(
        `SELECT (SELECT COUNT(*) FROM sales_orders WHERE status = 'pending_approval') + (SELECT COUNT(*) FROM purchase_orders WHERE status = 'pending_approval') + (SELECT COUNT(*) FROM purchase_requests WHERE status = 'pending_approval') as count`,
        [],
        { tenantId },
      );
      const pendingApproval = await this.dataSource.query(pendingApprovalSql);

      const [pendingShipmentSql] = withParams(
        `SELECT COUNT(*) as count FROM sales_orders WHERE status = 'approved'`,
        [],
        { tenantId },
      );
      const pendingShipment = await this.dataSource.query(pendingShipmentSql);

      const lowStock = await this.dataSource.query(`SELECT COUNT(*) as count FROM local_stock_balances WHERE qty <= 0`);

      kpis.push(
        { key: 'todayOrders', label: '今日订单', value: parseInt(todayOrders[0]?.count || '0', 10), suffix: '笔', color: '#2563EB', link: '/sales-orders' },
        { key: 'pendingApprovals', label: '待审批', value: parseInt(pendingApproval[0]?.count || '0', 10), suffix: '条', color: '#F59E0B', link: '/approvals' },
        { key: 'pendingShipment', label: '待发货', value: parseInt(pendingShipment[0]?.count || '0', 10), suffix: '条', color: '#7C3AED', link: '/sales-orders' },
        { key: 'lowStock', label: '库存预警', value: parseInt(lowStock[0]?.count || '0', 10), suffix: '个SKU', color: '#EF4444', link: '/products' },
      );

      // Admin pending items
      const [pendingListSql] = withParams(
        `SELECT id, order_no as title, status, 'sales_order' as type FROM sales_orders WHERE status = 'pending_approval' ORDER BY created_at DESC LIMIT 3`,
        [],
        { tenantId },
      );
      const pendingList = await this.dataSource.query(pendingListSql);
      pendingList.forEach((item: any) => {
        pendingItems.push({ id: item.id, title: item.title || '销售订单', status: '待审批', tag: '销售订单', link: '/approvals' });
      });
    } else if (role === 'sales') {
      // Sales KPIs
      const [myOrdersSql, myOrdersParams] = withParams(
        `SELECT COUNT(*) as count, COALESCE(SUM("payAmount"), 0) as amount FROM sales_orders WHERE created_at >= $1`,
        [monthStart.toISOString()],
        { userId, tenantId },
      );
      const myOrders = await this.dataSource.query(myOrdersSql, myOrdersParams);

      const [myPendingSql, myPendingParams] = withParams(
        `SELECT COUNT(*) as count FROM sales_orders WHERE status = 'pending_approval'`,
        [],
        { userId, tenantId },
      );
      const myPending = await this.dataSource.query(myPendingSql, myPendingParams);

      const [myWarningsSql, myWarningsParams] = withParams(
        `SELECT COUNT(*) as count FROM sales_orders WHERE delivery_warning IS NOT NULL`,
        [],
        { userId, tenantId },
      );
      const myWarnings = await this.dataSource.query(myWarningsSql, myWarningsParams);

      const [prepaySumSql, prepaySumParams] = withParams(
        `SELECT COALESCE(SUM(prepayment_balance), 0) as amount FROM customers WHERE 1=1`,
        [],
        { tenantId },
      );
      const prepaySum = await this.dataSource.query(prepaySumSql, prepaySumParams);

      kpis.push(
        { key: 'monthOrders', label: '本月订单', value: parseInt(myOrders[0]?.count || '0', 10), suffix: `${parseInt(myOrders[0]?.count || '0', 10)} 笔 / ¥${Number(myOrders[0]?.amount || 0).toFixed(0)}`, color: '#2563EB', link: '/sales-orders' },
        { key: 'pendingOrders', label: '待审批订单', value: parseInt(myPending[0]?.count || '0', 10), suffix: '笔', color: '#F59E0B', link: '/approvals' },
        { key: 'deliveryWarning', label: '交期预警', value: parseInt(myWarnings[0]?.count || '0', 10), suffix: '笔', color: '#EF4444', link: '/sales-orders' },
        { key: 'prepayment', label: '客户预付款', value: parseFloat(prepaySum[0]?.amount || '0'), suffix: '元', color: '#10B981', link: '/prepayments' },
      );

      // Sales pending items
      const [pendingOrdersSql, pendingOrdersParams] = withParams(
        `SELECT id, order_no as title, customer_id, status, created_at FROM sales_orders WHERE status = 'pending_approval' ORDER BY created_at DESC LIMIT 5`,
        [],
        { userId, tenantId },
      );
      const pendingOrders = await this.dataSource.query(pendingOrdersSql, pendingOrdersParams);
      pendingOrders.forEach((item: any) => {
        pendingItems.push({ id: item.id, title: item.title || '销售订单', description: '待审批', status: 'pending', tag: '待审批', link: '/approvals' });
      });
    } else if (role === 'purchaser') {
      // Purchaser KPIs
      const [myPurchasesSql, myPurchasesParams] = withParams(
        `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount FROM purchase_orders WHERE created_at >= $1`,
        [monthStart.toISOString()],
        { userId, tenantId },
      );
      const myPurchases = await this.dataSource.query(myPurchasesSql, myPurchasesParams);

      const [myPendingPOSql, myPendingPOParams] = withParams(
        `SELECT COUNT(*) as count FROM purchase_orders WHERE status = 'pending_approval'`,
        [],
        { userId, tenantId },
      );
      const myPendingPO = await this.dataSource.query(myPendingPOSql, myPendingPOParams);

      const [myPendingPRSql, myPendingPRParams] = withParams(
        `SELECT COUNT(*) as count FROM purchase_requests WHERE status = 'approved'`,
        [],
        { userId, tenantId },
      );
      const myPendingPR = await this.dataSource.query(myPendingPRSql, myPendingPRParams);

      const lowStock = await this.dataSource.query(`SELECT COUNT(*) as count FROM local_stock_balances WHERE qty <= 0`);

      kpis.push(
        { key: 'monthPurchase', label: '本月采购', value: parseInt(myPurchases[0]?.count || '0', 10), suffix: `${parseInt(myPurchases[0]?.count || '0', 10)} 笔 / ¥${Number(myPurchases[0]?.amount || 0).toFixed(0)}`, color: '#2563EB', link: '/purchase-orders' },
        { key: 'pendingPO', label: '待审批采购单', value: parseInt(myPendingPO[0]?.count || '0', 10), suffix: '笔', color: '#F59E0B', link: '/approvals' },
        { key: 'pendingPR', label: '待处理申请', value: parseInt(myPendingPR[0]?.count || '0', 10), suffix: '笔', color: '#7C3AED', link: '/purchase-requests' },
        { key: 'lowStock', label: '缺货SKU', value: parseInt(lowStock[0]?.count || '0', 10), suffix: '个', color: '#EF4444', link: '/products' },
      );

      // Purchaser pending items
      const [pendingPOsSql, pendingPOsParams] = withParams(
        `SELECT id, order_no as title, status, created_at FROM purchase_orders WHERE status = 'pending_approval' ORDER BY created_at DESC LIMIT 5`,
        [],
        { userId, tenantId },
      );
      const pendingPOs = await this.dataSource.query(pendingPOsSql, pendingPOsParams);
      pendingPOs.forEach((item: any) => {
        pendingItems.push({ id: item.id, title: item.title || '采购单', description: '待审批', status: 'pending', tag: '采购单', link: '/approvals' });
      });
    } else if (role === 'finance') {
      // Finance KPIs
      const monthCollection = await this.dataSource.query(
        `SELECT COALESCE(SUM(amount), 0) as amount FROM payment_records WHERE received_at >= $1`,
        [monthStart.toISOString()],
      );

      const [pendingInvoiceSql] = withParams(
        `SELECT COUNT(*) as count FROM sales_orders so WHERE so.status = 'approved' AND NOT EXISTS (SELECT 1 FROM invoice_records ir WHERE ir.sales_order_id = so.id::text)`,
        [],
        { tenantId },
      );
      const pendingInvoice = await this.dataSource.query(pendingInvoiceSql);

      const draftVouchers = await this.dataSource.query(
        `SELECT COUNT(*) as count FROM vouchers WHERE status = 'draft'`,
      );

      const monthInvoice = await this.dataSource.query(
        `SELECT COALESCE(SUM(amount), 0) as amount FROM invoice_records WHERE invoice_date >= $1`,
        [monthStart.toISOString()],
      );

      kpis.push(
        { key: 'monthCollection', label: '本月回款', value: parseFloat(monthCollection[0]?.amount || '0'), suffix: '元', color: '#10B981', link: '/invoices' },
        { key: 'pendingInvoice', label: '待开票订单', value: parseInt(pendingInvoice[0]?.count || '0', 10), suffix: '笔', color: '#F59E0B', link: '/invoices' },
        { key: 'draftVouchers', label: '未核销凭证', value: parseInt(draftVouchers[0]?.count || '0', 10), suffix: '笔', color: '#EF4444', link: '/vouchers' },
        { key: 'monthInvoice', label: '本月发票', value: parseFloat(monthInvoice[0]?.amount || '0'), suffix: '元', color: '#2563EB', link: '/invoices' },
      );

      // Finance pending items
      const [pendingInvoicesSql] = withParams(
        `SELECT so.id, so.order_no as title, so.customer_id, so."payAmount" as amount FROM sales_orders so WHERE so.status = 'approved' AND NOT EXISTS (SELECT 1 FROM invoice_records ir WHERE ir.sales_order_id = so.id::text) ORDER BY so.created_at DESC LIMIT 5`,
        [],
        { tenantId },
      );
      const pendingInvoices = await this.dataSource.query(pendingInvoicesSql);
      pendingInvoices.forEach((item: any) => {
        pendingItems.push({ id: item.id, title: item.title || '销售订单', description: `¥${Number(item.amount || 0).toFixed(2)}`, status: 'approved', tag: '待开票', link: '/invoices' });
      });
    } else {
      // 默认 fallback 到 sales
      const [myOrdersSql, myOrdersParams] = withParams(
        `SELECT COUNT(*) as count, COALESCE(SUM("payAmount"), 0) as amount FROM sales_orders WHERE created_at >= $1`,
        [monthStart.toISOString()],
        { userId, tenantId },
      );
      const myOrders = await this.dataSource.query(myOrdersSql, myOrdersParams);
      kpis.push(
        { key: 'monthOrders', label: '本月订单', value: parseFloat(myOrders[0]?.amount || '0'), suffix: `笔 / ¥${Number(myOrders[0]?.amount || 0).toFixed(0)}`, color: '#2563EB', link: '/sales-orders' },
      );
    }

    return { role, kpis, pendingItems };
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

    // 角色变更时，若未显式传入 permissions，则自动填充该角色的默认权限
    if (body.role && typeof body.role === 'string' && !('permissions' in body)) {
      body.permissions = getDefaultPermissionsForRole(body.role);
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
