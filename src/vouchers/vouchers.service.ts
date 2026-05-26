import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like } from 'typeorm';
import { Voucher, VoucherStatus } from './entities/voucher.entity';
import { VoucherItem } from './entities/voucher-item.entity';
import { CreateVoucherDto } from './dto/create-voucher.dto';
import { UpdateVoucherDto } from './dto/update-voucher.dto';

@Injectable()
export class VouchersService {
  constructor(
    @InjectRepository(Voucher)
    private readonly voucherRepo: Repository<Voucher>,
    @InjectRepository(VoucherItem)
    private readonly itemRepo: Repository<VoucherItem>,
    private readonly dataSource: DataSource,
  ) {}

  private async generateVoucherNo(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `PZ-${dateStr}`;

    const count = await this.voucherRepo.count({
      where: { voucherNo: Like(`${prefix}-%`) },
    });
    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  async create(dto: CreateVoucherDto) {
    return this.dataSource.transaction(async (manager) => {
      const voucherRepo = manager.getRepository(Voucher);
      const itemRepo = manager.getRepository(VoucherItem);

      const voucherNo = dto.voucherNo || (await this.generateVoucherNo());

      const voucher = voucherRepo.create({
        voucherNo,
        voucherDate: dto.voucherDate,
        type: dto.type,
        description: dto.description,
        totalAmount: dto.totalAmount,
        status: dto.status || VoucherStatus.DRAFT,
        sourceType: dto.sourceType || null,
        sourceId: dto.sourceId || null,
      });

      const saved = await voucherRepo.save(voucher);

      if (dto.items?.length) {
        const items = dto.items.map((it) =>
          itemRepo.create({
            voucherId: saved.id,
            accountCode: it.accountCode,
            accountName: it.accountName || null,
            debitAmount: it.debitAmount || 0,
            creditAmount: it.creditAmount || 0,
            description: it.description || null,
          }),
        );
        await itemRepo.save(items);
      }

      return saved;
    });
  }

  async findAll(
    page: number = 1,
    pageSize: number = 20,
    filters?: {
      keyword?: string;
      type?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      sourceType?: string;
      sourceId?: string;
    },
  ) {
    const qb = this.voucherRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.items', 'items')
      .orderBy('v.createdAt', 'DESC');

    if (filters?.keyword) {
      qb.andWhere('v.voucher_no ILIKE :kw', { kw: `%${filters.keyword}%` });
    }
    if (filters?.type) {
      qb.andWhere('v.type = :type', { type: filters.type });
    }
    if (filters?.status) {
      qb.andWhere('v.status = :status', { status: filters.status });
    }
    if (filters?.dateFrom) {
      qb.andWhere('v.voucher_date >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters?.dateTo) {
      qb.andWhere('v.voucher_date <= :dateTo', { dateTo: filters.dateTo });
    }
    if (filters?.sourceType) {
      qb.andWhere('v.source_type = :sourceType', { sourceType: filters.sourceType });
    }
    if (filters?.sourceId) {
      qb.andWhere('v.source_id = :sourceId', { sourceId: filters.sourceId });
    }

    const [data, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total, page, pageSize };
  }

  async findBySource(sourceType: string, sourceId: string) {
    return this.voucherRepo.find({
      where: { sourceType, sourceId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const voucher = await this.voucherRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!voucher) throw new NotFoundException('凭证不存在');
    return voucher;
  }

  async update(id: string, dto: UpdateVoucherDto) {
    return this.dataSource.transaction(async (manager) => {
      const voucherRepo = manager.getRepository(Voucher);
      const itemRepo = manager.getRepository(VoucherItem);

      const voucher = await voucherRepo.findOne({
        where: { id },
        relations: ['items'],
      });
      if (!voucher) throw new NotFoundException('凭证不存在');

      Object.assign(voucher, dto);
      const saved = await voucherRepo.save(voucher);

      if (dto.items?.length) {
        // 删除旧明细
        if (voucher.items?.length) {
          await itemRepo.remove(voucher.items);
        }
        const items = dto.items.map((it) =>
          itemRepo.create({
            voucherId: saved.id,
            accountCode: it.accountCode,
            accountName: it.accountName || null,
            debitAmount: it.debitAmount || 0,
            creditAmount: it.creditAmount || 0,
            description: it.description || null,
          }),
        );
        await itemRepo.save(items);
      }

      return saved;
    });
  }

  async remove(id: string) {
    const voucher = await this.findOne(id);
    return this.voucherRepo.remove(voucher);
  }

  async post(id: string) {
    const voucher = await this.findOne(id);
    if (voucher.status !== VoucherStatus.DRAFT) {
      throw new BadRequestException('只有草稿凭证可以过账');
    }
    voucher.status = VoucherStatus.POSTED;
    return this.voucherRepo.save(voucher);
  }

  async cancel(id: string) {
    const voucher = await this.findOne(id);
    if (voucher.status === VoucherStatus.CANCELLED) {
      throw new BadRequestException('凭证已作废');
    }
    voucher.status = VoucherStatus.CANCELLED;
    return this.voucherRepo.save(voucher);
  }
}
