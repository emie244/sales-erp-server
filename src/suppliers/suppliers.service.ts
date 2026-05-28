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

  async findAll(
    page: number = 1,
    pageSize: number = 20,
    keyword?: string,
    status?: string,
    sortField?: string,
    sortOrder?: 'ASC' | 'DESC',
  ) {
    const qb = this.repo.createQueryBuilder('s');

    if (keyword) {
      qb.andWhere(
        '(s.name ILIKE :keyword OR s.contact_name ILIKE :keyword OR s.phone ILIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    if (status === 'active') {
      qb.andWhere('s.is_active = true');
    } else if (status === 'inactive') {
      qb.andWhere('s.is_active = false');
    }

    const orderField = sortField || 'createdAt';
    const orderDir = sortOrder || 'DESC';
    qb.orderBy(`s.${orderField}`, orderDir);

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize };
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
