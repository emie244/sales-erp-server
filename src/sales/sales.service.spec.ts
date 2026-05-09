import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SalesService } from './sales.service';
import { SalesOrder } from './entities/sales-order.entity';
import { SalesOrderItem } from './entities/sales-order-item.entity';
import { Customer } from '../customers/entities/customer.entity';
import { PaymentRecord } from '../payments/entities/payment-record.entity';
import { ApprovalRecord } from '../approvals/entities/approval-record.entity';
import { DeliveryOrder } from '../deliveries/entities/delivery-order.entity';
import { ProductsService } from '../products/products.service';
import { ApprovalService } from '../approvals/approval.service';
import { JushuitanService } from '../integrations/jushuitan.service';

describe('SalesService', () => {
  let service: SalesService;

  const repoMocks = [
    { entity: SalesOrder, token: getRepositoryToken(SalesOrder) },
    { entity: SalesOrderItem, token: getRepositoryToken(SalesOrderItem) },
    { entity: Customer, token: getRepositoryToken(Customer) },
    { entity: PaymentRecord, token: getRepositoryToken(PaymentRecord) },
    { entity: ApprovalRecord, token: getRepositoryToken(ApprovalRecord) },
    { entity: DeliveryOrder, token: getRepositoryToken(DeliveryOrder) },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        ...repoMocks.map(({ token }) => ({
          provide: token,
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            save: jest.fn(),
            create: jest.fn((v) => v),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
            })),
          },
        })),
        {
          provide: ProductsService,
          useValue: { findSkuById: jest.fn() },
        },
        {
          provide: ApprovalService,
          useValue: { submitForApproval: jest.fn() },
        },
        {
          provide: JushuitanService,
          useValue: { createSalesOrder: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((fn) =>
              fn({
                getRepository: jest.fn().mockReturnValue({
                  create: jest.fn((v) => v),
                  save: jest.fn(),
                  remove: jest.fn(),
                }),
              }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateCommissionRate', () => {
    const calc = (...args: [Date | null, string | null, Date]) =>
      (service as any).calculateCommissionRate(...args);

    it('returns 0.03 for new lifecycle stage', () => {
      expect(calc(new Date(), 'new', new Date())).toBe(0.03);
    });

    it('returns 0.02 for growth lifecycle stage', () => {
      expect(calc(new Date(), 'growth', new Date())).toBe(0.02);
    });

    it('returns 0.01 for mature/decline/discontinued lifecycle stages', () => {
      expect(calc(new Date(), 'mature', new Date())).toBe(0.01);
      expect(calc(new Date(), 'decline', new Date())).toBe(0.01);
      expect(calc(new Date(), 'discontinued', new Date())).toBe(0.01);
    });

    it('returns 0.01 when no launchDate and no stage', () => {
      expect(calc(null, null, new Date())).toBe(0.01);
    });

    it('returns 0.03 when launchDate is within 90 days', () => {
      const launch = new Date('2025-01-01');
      const order = new Date('2025-03-01');
      expect(calc(launch, null, order)).toBe(0.03);
    });

    it('returns 0.02 when launchDate is within 180 days', () => {
      const launch = new Date('2025-01-01');
      const order = new Date('2025-06-01');
      expect(calc(launch, null, order)).toBe(0.02);
    });

    it('returns 0.01 when launchDate is more than 180 days ago', () => {
      const launch = new Date('2024-01-01');
      const order = new Date('2025-01-01');
      expect(calc(launch, null, order)).toBe(0.01);
    });
  });

  describe('findAll', () => {
    it('should paginate results', async () => {
      const result = await service.findAll(2, 10);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });
  });
});
