import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { InvoiceRecord, InvoiceStatus } from './entities/invoice-record.entity';
import { CreateInvoiceRecordDto } from './dto/create-invoice-record.dto';
import { UpdateInvoiceRecordDto } from './dto/update-invoice-record.dto';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(InvoiceRecord)
    private readonly repo: Repository<InvoiceRecord>,
  ) {}

  async create(dto: CreateInvoiceRecordDto) {
    const record = this.repo.create({
      ...dto,
      status: dto.status || InvoiceStatus.DRAFT,
    });
    return this.repo.save(record);
  }

  async findAll(
    page: number = 1,
    pageSize: number = 20,
    filters?: {
      salesOrderId?: string;
      keyword?: string;
      status?: string;
    },
  ) {
    const qb = this.repo.createQueryBuilder('i').orderBy('i.createdAt', 'DESC');

    if (filters?.salesOrderId) {
      qb.andWhere('i.sales_order_id = :soId', { soId: filters.salesOrderId });
    }
    if (filters?.keyword) {
      qb.andWhere('i.invoice_no ILIKE :kw', { kw: `%${filters.keyword}%` });
    }
    if (filters?.status) {
      qb.andWhere('i.status = :status', { status: filters.status });
    }

    const [data, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total, page, pageSize };
  }

  async findOne(id: string) {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('发票记录不存在');
    return record;
  }

  async update(id: string, dto: UpdateInvoiceRecordDto) {
    const record = await this.findOne(id);
    Object.assign(record, dto);
    return this.repo.save(record);
  }

  async remove(id: string) {
    const record = await this.findOne(id);
    return this.repo.remove(record);
  }
}
