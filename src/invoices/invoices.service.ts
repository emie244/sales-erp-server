import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { InvoiceRecord, InvoiceStatus } from './entities/invoice-record.entity';
import { CreateInvoiceRecordDto } from './dto/create-invoice-record.dto';
import { UpdateInvoiceRecordDto } from './dto/update-invoice-record.dto';
import { VouchersService } from '../vouchers/vouchers.service';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(InvoiceRecord)
    private readonly repo: Repository<InvoiceRecord>,
    private readonly vouchersService: VouchersService,
  ) {}

  async create(dto: CreateInvoiceRecordDto) {
    const record = this.repo.create({
      ...dto,
      status: dto.status || InvoiceStatus.DRAFT,
      paidAmount: 0,
      remainingAmount: dto.amount || 0,
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

  async confirmInvoice(id: string, issuer?: string) {
    const record = await this.findOne(id);
    if (record.status === InvoiceStatus.ISSUED) {
      return record;
    }
    if (record.status === InvoiceStatus.CANCELLED) {
      throw new NotFoundException('发票已作废，无法确认');
    }

    record.status = InvoiceStatus.ISSUED;
    record.invoiceDate = new Date();
    if (issuer) record.issuer = issuer;

    const saved = await this.repo.save(record);

    // 自动生成发票凭证（不阻塞）
    try {
      const amount = Number(record.amount || 0);
      if (amount > 0) {
        // 简易分录：借应收账款 贷主营业务收入（不含税拆分，实际可按税率拆分）
        await this.vouchersService.create({
          voucherNo: '',
          voucherDate: new Date().toISOString(),
          type: 'receivable' as any,
          description: `发票确认: ${record.invoiceNo}`,
          totalAmount: amount,
          sourceType: 'invoice',
          sourceId: record.id,
          items: [
            {
              accountCode: '1122',
              accountName: '应收账款',
              debitAmount: amount,
              creditAmount: 0,
            },
            {
              accountCode: '6001',
              accountName: '主营业务收入',
              debitAmount: 0,
              creditAmount: amount,
            },
          ],
        } as any);
        this.logger.log(`Auto-generated invoice voucher for invoice ${id}`);
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to auto-generate voucher for invoice ${id}: ${err.message}`,
      );
    }

    return saved;
  }
}
