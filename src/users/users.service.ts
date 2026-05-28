import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findByName(name: string) {
    return this.repo.findOne({ where: { name } });
  }

  async findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  async findByPhone(phone: string) {
    return this.repo.findOne({ where: { phone } });
  }

  async findByFeishuOpenId(feishuOpenId: string) {
    return this.repo.findOne({ where: { feishuOpenId } });
  }

  async findAll(
    tenantId?: string,
    keyword?: string,
    role?: string,
    sortField?: string,
    sortOrder?: 'ASC' | 'DESC',
  ) {
    const qb = this.repo.createQueryBuilder('u');

    if (tenantId) {
      qb.andWhere('u.tenant_id = :tenantId', { tenantId });
    }

    qb.andWhere('u.isActive = true');

    if (keyword) {
      qb.andWhere(
        '(u.name ILIKE :keyword OR u.email ILIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    if (role) {
      qb.andWhere('u.role = :role', { role });
    }

    const orderField = sortField || 'createdAt';
    const orderDir = sortOrder || 'DESC';
    qb.orderBy(`u.${orderField}`, orderDir);

    return qb.getMany();
  }

  async create(data: Partial<User>) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    if (
      data.role === 'admin' &&
      (!data.permissions || data.permissions.length === 0)
    ) {
      data.permissions = ['*'];
    }
    if (
      data.role !== 'admin' &&
      (!data.permissions || data.permissions.length === 0)
    ) {
      data.permissions = [
        'order:view', 'order:create', 'order:edit', 'order:submit',
        'order:push_jst', 'order:collect',
        'customer:view', 'customer:create', 'customer:edit',
        'product:view', 'product:create', 'product:edit',
        'prepayment:view', 'prepayment:create', 'prepayment:edit',
        'approval:view', 'approval:handle',
        'report:view',
        'stock:view',
        'bom:view',
        'supplier:view',
        'purchase_order:view', 'purchase_request:view',
        'production_order:view',
        'material_category:view',
        'invoice:view', 'invoice:create', 'invoice:edit', 'invoice:delete',
        'voucher:view', 'voucher:create', 'voucher:edit', 'voucher:delete',
      ];
    }
    const user = this.repo.create(data);
    return this.repo.save(user);
  }

  async update(id: string, data: Partial<User>) {
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    // 使用 update 直接执行 SQL，避免 TypeORM save 对 jsonb 字段的变更检测失效
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  async findOne(id: string) {
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
