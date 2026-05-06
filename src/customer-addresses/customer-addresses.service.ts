import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerAddress } from './entities/customer-address.entity';
import { CreateCustomerAddressDto } from './dto/create-customer-address.dto';

@Injectable()
export class CustomerAddressesService {
  constructor(
    @InjectRepository(CustomerAddress)
    private readonly repo: Repository<CustomerAddress>,
  ) {}

  async create(dto: CreateCustomerAddressDto) {
    const entity = this.repo.create(dto);
    if (dto.isDefault) {
      await this.clearDefault(dto.customerId);
    }
    return this.repo.save(entity);
  }

  async findByCustomer(customerId: string) {
    return this.repo.find({
      where: { customerId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const entity = await this.repo.findOneBy({ id });
    if (!entity) throw new NotFoundException('Address not found');
    return entity;
  }

  async update(id: string, dto: Partial<CreateCustomerAddressDto>) {
    const entity = await this.findOne(id);
    if (dto.isDefault) {
      await this.clearDefault(entity.customerId);
    }
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string) {
    const entity = await this.findOne(id);
    await this.repo.delete(id);
    return entity;
  }

  async setDefault(id: string) {
    const entity = await this.findOne(id);
    await this.clearDefault(entity.customerId);
    await this.repo.update(id, { isDefault: true });
    return this.findOne(id);
  }

  private async clearDefault(customerId: string) {
    await this.repo.update(
      { customerId, isDefault: true },
      { isDefault: false },
    );
  }
}
