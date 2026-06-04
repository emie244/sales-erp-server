import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrderQueryService } from './sales-order-query.service';
import { SalesOrder } from '../entities/sales-order.entity';
import { ApprovalRecord } from '../../approvals/entities/approval-record.entity';
import { PaymentRecord } from '../../payments/entities/payment-record.entity';
import { DeliveryOrder } from '../../deliveries/entities/delivery-order.entity';
import { ProductionOrder } from '../../production-orders/entities/production-order.entity';

describe('SalesOrderQueryService', () => {
  let service: SalesOrderQueryService;
  let orderRepo: jest.Mocked<Repository<SalesOrder>>;
  let approvalRepo: jest.Mocked<Repository<ApprovalRecord>>;
  let paymentRepo: jest.Mocked<Repository<PaymentRecord>>;
  let deliveryRepo: jest.Mocked<Repository<DeliveryOrder>>;
  let productionOrderRepo: jest.Mocked<Repository<ProductionOrder>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesOrderQueryService,
        {
          provide: getRepositoryToken(SalesOrder),
          useValue: {
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ApprovalRecord),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(PaymentRecord),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(DeliveryOrder),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(ProductionOrder),
          useValue: { find: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(SalesOrderQueryService);
    orderRepo = module.get(getRepositoryToken(SalesOrder));
    approvalRepo = module.get(getRepositoryToken(ApprovalRecord));
    paymentRepo = module.get(getRepositoryToken(PaymentRecord));
    deliveryRepo = module.get(getRepositoryToken(DeliveryOrder));
    productionOrderRepo = module.get(getRepositoryToken(ProductionOrder));
  });

  describe('findOne', () => {
    it('should return order with serializable data (no circular refs)', async () => {
      const mockOrder = {
        id: 'test-id',
        status: 'shipped',
        type: 'sales',
        customerId: 'cust-1',
        customerName: 'Test Customer',
        salespersonId: 'user-2',
        salespersonName: 'Salesperson',
        creatorId: 'user-1',
        totalAmount: 100,
        payAmount: 100,
        discountAmount: 0,
        collectedAmount: 50,
        prepaymentDeducted: 0,
        remark: 'test remark',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customer: { id: 'cust-1', name: 'Test Customer' },
        items: [
          {
            id: 'item-1',
            skuId: 'sku-1',
            skuName: 'Test SKU',
            skuCode: 'code-1',
            qty: 1,
            unitPrice: 100,
            lineAmount: 100,
            productId: 'prod-1',
          },
        ],
        creator: { id: 'user-1', name: 'Creator' },
        salesperson: { id: 'user-2', name: 'Salesperson' },
      } as any;

      orderRepo.findOne.mockResolvedValue(mockOrder);
      approvalRepo.find.mockResolvedValue([]);
      deliveryRepo.find.mockResolvedValue([]);
      paymentRepo.find.mockResolvedValue([]);
      productionOrderRepo.find.mockResolvedValue([]);

      const result = await service.findOne('test-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('test-id');
      expect(result.status).toBe('shipped');
      expect(result.customer).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.approvalRecords).toEqual([]);
      // Critical: must be serializable without circular references
      expect(() => JSON.stringify(result)).not.toThrow();
    });

    it('should throw NotFoundException when order not found', async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(
        'Sales order not found',
      );
    });
  });
});
