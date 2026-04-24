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

  async findByFeishuOpenId(feishuOpenId: string) {
    return this.repo.findOne({ where: { feishuOpenId } });
  }

  findAll(tenantId?: string) {
    return this.repo.find({
      where: tenantId
        ? { tenantId, isActive: true }
        : { isActive: true },
    });
  }

  async create(data: Partial<User>) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
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
