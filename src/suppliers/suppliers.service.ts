import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly repo: Repository<Supplier>,
  ) {}

  async create(dto: CreateSupplierDto) {
    const supplier = this.repo.create(dto);
    return this.repo.save(supplier);
  }

  findAll() {
    return this.repo.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const supplier = await this.repo.findOneBy({ id });
    if (!supplier) throw new NotFoundException('供应商不存在');
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const supplier = await this.findOne(id);
    Object.assign(supplier, dto);
    return this.repo.save(supplier);
  }

  async remove(id: string) {
    const supplier = await this.findOne(id);
    supplier.isActive = false;
    return this.repo.save(supplier);
  }
}
