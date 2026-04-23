import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,
  ) {}

  create(dto: CreateCustomerDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async findAll(page: number = 1, pageSize: number = 20) {
    const [data, total] = await this.repo.findAndCount({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total, page, pageSize };
  }

  async findOne(id: string) {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Customer not found');
    return entity;
  }

  async update(id: string, dto: Partial<CreateCustomerDto>) {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }
}
