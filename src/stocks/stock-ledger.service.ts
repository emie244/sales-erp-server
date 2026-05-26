import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { StockLedger } from './entities/stock-ledger.entity';
import { LocalStockBalance } from './entities/local-stock-balance.entity';

export interface StockDeductionInput {
  skuId: string;
  qty: number;
  referenceType: 'sales_order' | 'purchase_order' | 'production_order' | 'adjustment';
  referenceId: string;
  remark?: string;
}

export interface StockAdditionInput {
  skuId: string;
  qty: number;
  referenceType: 'purchase_order' | 'production_order' | 'adjustment' | 'initial';
  referenceId: string;
  remark?: string;
}

@Injectable()
export class StockLedgerService {
  private readonly logger = new Logger(StockLedgerService.name);

  constructor(
    @InjectRepository(StockLedger)
    private readonly ledgerRepo: Repository<StockLedger>,
    @InjectRepository(LocalStockBalance)
    private readonly balanceRepo: Repository<LocalStockBalance>,
    private readonly dataSource: DataSource,
  ) {}

  async deductOutbound(input: StockDeductionInput): Promise<StockLedger> {
    return this.dataSource.transaction(async (manager) => {
      const balanceRepo = manager.getRepository(LocalStockBalance);
      const ledgerRepo = manager.getRepository(StockLedger);

      // 行锁防止并发超卖
      let balance = await balanceRepo
        .createQueryBuilder('b')
        .setLock('pessimistic_write')
        .where('b.sku_id = :skuId', { skuId: input.skuId })
        .getOne();

      const beforeQty = balance ? Number(balance.qty) : 0;
      const afterQty = beforeQty - input.qty;

      if (afterQty < -0.0001) {
        throw new BadRequestException(
          `SKU 库存不足：当前库存 ${beforeQty}，需要扣减 ${input.qty}`
        );
      }

      if (!balance) {
        balance = balanceRepo.create({
          skuId: input.skuId,
          qty: afterQty,
        });
      } else {
        balance.qty = afterQty;
      }
      await balanceRepo.save(balance);

      const ledger = ledgerRepo.create({
        skuId: input.skuId,
        type: 'outbound',
        qty: input.qty,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        beforeQty,
        afterQty,
        remark: input.remark,
      });

      this.logger.log(
        `Stock deducted: sku=${input.skuId}, qty=${input.qty}, before=${beforeQty}, after=${afterQty}, ref=${input.referenceType}:${input.referenceId}`
      );

      return ledgerRepo.save(ledger);
    });
  }

  async addInbound(input: StockAdditionInput): Promise<StockLedger> {
    return this.dataSource.transaction(async (manager) => {
      const balanceRepo = manager.getRepository(LocalStockBalance);
      const ledgerRepo = manager.getRepository(StockLedger);

      let balance = await balanceRepo
        .createQueryBuilder('b')
        .setLock('pessimistic_write')
        .where('b.sku_id = :skuId', { skuId: input.skuId })
        .getOne();

      const beforeQty = balance ? Number(balance.qty) : 0;
      const afterQty = beforeQty + input.qty;

      if (!balance) {
        balance = balanceRepo.create({
          skuId: input.skuId,
          qty: afterQty,
        });
      } else {
        balance.qty = afterQty;
      }
      await balanceRepo.save(balance);

      const ledger = ledgerRepo.create({
        skuId: input.skuId,
        type: 'inbound',
        qty: input.qty,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        beforeQty,
        afterQty,
        remark: input.remark,
      });

      this.logger.log(
        `Stock added: sku=${input.skuId}, qty=${input.qty}, before=${beforeQty}, after=${afterQty}, ref=${input.referenceType}:${input.referenceId}`
      );

      return ledgerRepo.save(ledger);
    });
  }

  async getBalance(skuId: string): Promise<number> {
    const balance = await this.balanceRepo.findOne({
      where: { skuId },
    });
    return balance ? Number(balance.qty) : 0;
  }

  async findLedgerBySku(
    skuId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ data: StockLedger[]; total: number }> {
    const [data, total] = await this.ledgerRepo.findAndCount({
      where: { skuId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total };
  }

  async findAllBalances(
    page: number = 1,
    pageSize: number = 50,
    keyword?: string
  ): Promise<{ data: LocalStockBalance[]; total: number }> {
    const qb = this.balanceRepo
      .createQueryBuilder('b')
      .orderBy('b.updatedAt', 'DESC');

    if (keyword) {
      qb.andWhere('b.sku_id = :keyword', { keyword });
    }

    const [data, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total };
  }
}
