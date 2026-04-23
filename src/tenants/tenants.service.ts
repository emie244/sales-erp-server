import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly repo: Repository<Tenant>,
  ) {}

  findAll() {
    return this.repo.find();
  }

  async findOne(id: string) {
    const tenant = await this.repo.findOneBy({ id });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async create(data: Partial<Tenant>) {
    const tenant = this.repo.create(data);
    return this.repo.save(tenant);
  }

  async update(id: string, data: Partial<Tenant>) {
    const tenant = await this.repo.findOneBy({ id });
    if (!tenant) throw new NotFoundException('Tenant not found');
    Object.assign(tenant, data);
    return this.repo.save(tenant);
  }

  async remove(id: string) {
    const tenant = await this.repo.findOneBy({ id });
    if (!tenant) throw new NotFoundException('Tenant not found');
    tenant.isActive = false;
    return this.repo.save(tenant);
  }
}
