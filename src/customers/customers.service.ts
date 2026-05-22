import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';

type CustomerListFilters = {
  customerStatus?: string | string[];
  autoTier?: string | string[];
  primaryAssigneeId?: string;
  tag?: string;
  reviewNeeded?: boolean;
};

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,
  ) {}

  create(dto: CreateCustomerDto, tenantId?: string) {
    return this.repo.save(this.repo.create({ ...dto, tenantId }));
  }

  async batchCreate(dtos: CreateCustomerDto[], tenantId?: string) {
    const entities = dtos.map((dto) => this.repo.create({ ...dto, tenantId }));
    const result = await this.repo.save(entities);
    return { imported: result.length };
  }

  async findAll(
    page: number = 1,
    pageSize: number = 20,
    tenantId?: string,
    filters: CustomerListFilters = {},
  ) {
    const qb = this.repo.createQueryBuilder('c').orderBy('c.createdAt', 'DESC');

    if (tenantId) {
      qb.andWhere('c.tenantId = :tenantId', { tenantId });
    }

    if (filters.customerStatus) {
      const statuses = Array.isArray(filters.customerStatus)
        ? filters.customerStatus
        : [filters.customerStatus];
      qb.andWhere('c.customerStatus IN (:...statuses)', { statuses });
    } else {
      qb.andWhere("c.customerStatus IN ('active', 'lead')");
    }

    if (filters.autoTier) {
      const tiers = Array.isArray(filters.autoTier)
        ? filters.autoTier
        : [filters.autoTier];
      qb.andWhere('c.autoTier IN (:...tiers)', { tiers });
    }

    if (filters.primaryAssigneeId) {
      qb.andWhere('c.primaryAssigneeId = :assignee', {
        assignee: filters.primaryAssigneeId,
      });
    }

    if (filters.tag) {
      qb.andWhere(`c.tags @> :tagArr::jsonb`, {
        tagArr: JSON.stringify([filters.tag]),
      });
    }

    if (filters.reviewNeeded) {
      qb.andWhere(`c.tags @> :reviewArr::jsonb`, {
        reviewArr: JSON.stringify(['review-needed']),
      });
    }

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async findOne(id: string, withAddresses = false) {
    const options: { where: { id: string }; relations?: string[] } = {
      where: { id },
    };
    if (withAddresses) {
      options.relations = ['addresses'];
    }
    const entity = await this.repo.findOne(options);
    if (!entity) throw new NotFoundException('Customer not found');
    return entity;
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.repo.find({ where: { id: In(ids) } });
  }

  async update(id: string, dto: Partial<CreateCustomerDto>) {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    const entity = await this.findOne(id);
    entity.customerStatus = 'dormant';
    return this.repo.save(entity);
  }
}
