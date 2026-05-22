import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SalesService } from './sales.service';
import { SalesOrder, SalesOrderStatus } from './entities/sales-order.entity';
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
  let productsService: ProductsService;
  let approvalService: ApprovalService;
  let jstService: JushuitanService;

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
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            save: jest.fn((v) => Promise.resolve(v)),
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
          useValue: {
            submitForApproval: jest.fn(),
            submitCollectionForApproval: jest.fn(),
          },
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
                  save: jest.fn((v) => Promise.resolve(v)),
                  remove: jest.fn(),
                }),
              }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
    productsService = module.get<ProductsService>(ProductsService);
    approvalService = module.get<ApprovalService>(ApprovalService);
    jstService = module.get<JushuitanService>(JushuitanService);
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

  describe('create', () => {
    it('should create order with items and calculate amounts', async () => {
      const mockSku = {
        id: 'sku-1',
        skuCode: 'SKU001',
        jstSkuId: 'jst-001',
        product: {
          id: 'prod-1',
          name: 'Test Product',
          launchDate: null,
          lifecycleStage: null,
        },
      };
      jest
        .spyOn(productsService, 'findSkuById')
        .mockResolvedValue(mockSku as any);

      const dto = {
        customerId: 'cust-1',
        type: 'sales' as const,
        items: [
          { skuId: 'sku-1', productId: 'prod-1', qty: 2, unitPrice: 100 },
        ],
        remark: 'Test order',
      };

      const result = await service.create(dto, 'user-1');

      expect(result.customerId).toBe('cust-1');
      expect(result.status).toBe(SalesOrderStatus.DRAFT);
      expect(result.totalAmount).toBe(200);
      expect(result.payAmount).toBe(200);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].lineAmount).toBe(200);
      expect(result.items[0].commissionRate).toBe(0.01);
      expect(result.items[0].commissionAmount).toBe(2);
    });

    it('should throw when SKU not found', async () => {
      jest.spyOn(productsService, 'findSkuById').mockResolvedValue(null as any);

      const dto = {
        customerId: 'cust-1',
        type: 'sales' as const,
        items: [{ skuId: 'invalid', qty: 1, unitPrice: 100 }],
      };

      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        'SKU invalid not found',
      );
    });

    it('should throw when product not found for SKU', async () => {
      jest
        .spyOn(productsService, 'findSkuById')
        .mockResolvedValue({ id: 'sku-1', product: null } as any);

      const dto = {
        customerId: 'cust-1',
        type: 'sales' as const,
        items: [{ skuId: 'sku-1', qty: 1, unitPrice: 100 }],
      };

      await expect(service.create(dto, 'user-1')).rejects.toThrow(
        'Product for SKU sku-1 not found',
      );
    });

    it('should apply new product commission rate (0.03)', async () => {
      const mockSku = {
        id: 'sku-1',
        product: {
          id: 'prod-1',
          name: 'New Product',
          launchDate: new Date(),
          lifecycleStage: 'new',
        },
      };
      jest
        .spyOn(productsService, 'findSkuById')
        .mockResolvedValue(mockSku as any);

      const dto = {
        customerId: 'cust-1',
        type: 'sales' as const,
        items: [{ skuId: 'sku-1', qty: 1, unitPrice: 1000 }],
      };

      const result = await service.create(dto, 'user-1');

      expect(result.items[0].commissionRate).toBe(0.03);
      expect(result.items[0].commissionAmount).toBe(30);
    });

    it('should apply discount to line amount', async () => {
      const mockSku = {
        id: 'sku-1',
        skuCode: 'SKU001',
        product: {
          id: 'prod-1',
          name: 'Product',
          launchDate: null,
          lifecycleStage: null,
        },
      };
      jest
        .spyOn(productsService, 'findSkuById')
        .mockResolvedValue(mockSku as any);

      const dto = {
        customerId: 'cust-1',
        type: 'sales' as const,
        items: [{ skuId: 'sku-1', qty: 2, unitPrice: 100, discountAmount: 50 }],
      };

      const result = await service.create(dto, 'user-1');

      expect(result.items[0].lineAmount).toBe(150);
      expect(result.totalAmount).toBe(150);
    });
  });

  describe('submit', () => {
    it('should submit draft order for approval', async () => {
      const mockOrder = {
        id: 'order-1',
        status: SalesOrderStatus.DRAFT,
        customer: { name: 'Test' },
        items: [],
        salesperson: null,
      };
      const orderRepo = {
        findOne: jest.fn().mockResolvedValue(mockOrder),
        save: jest.fn((v) => Promise.resolve(v)),
      };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });

      jest
        .spyOn(approvalService, 'submitForApproval')
        .mockResolvedValue(undefined);

      const result = await service.submit(
        'order-1',
        'feishu-user-1',
        'approval-code-1',
      );

      expect(result.status).toBe(SalesOrderStatus.PENDING_APPROVAL);
      expect(approvalService.submitForApproval).toHaveBeenCalled();
    });

    it('should throw when order not found', async () => {
      const orderRepo = { findOne: jest.fn().mockResolvedValue(null) };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });

      await expect(
        service.submit('invalid', 'feishu-user-1', 'code'),
      ).rejects.toThrow('Order not found');
    });

    it('should throw when order is not draft', async () => {
      const mockOrder = {
        id: 'order-1',
        status: SalesOrderStatus.APPROVED,
      };
      const orderRepo = { findOne: jest.fn().mockResolvedValue(mockOrder) };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });

      await expect(
        service.submit('order-1', 'feishu-user-1', 'code'),
      ).rejects.toThrow('Only draft order can be submitted');
    });
  });

  describe('batchPushJushuitan', () => {
    it('should push approved order to Jushuitan successfully', async () => {
      const mockOrder = {
        id: 'order-1',
        status: SalesOrderStatus.APPROVED,
        salesperson: {
          id: 'user-1',
          name: 'Signer',
          jushuitanShopId: 'shop-1',
        },
        items: [
          {
            skuId: 'sku-1',
            skuName: 'Product A',
            skuCode: 'SKU001',
            jstSkuId: 'jst-001',
            qty: 1,
            unitPrice: 100,
          },
        ],
        customer: { name: 'Customer' },
      };
      const orderRepo = {
        findOne: jest.fn().mockResolvedValue(mockOrder),
        save: jest.fn((v) => Promise.resolve(v)),
      };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });
      jest.spyOn(productsService, 'findSkuById').mockResolvedValue({
        id: 'sku-1',
        skuCode: 'SKU001',
        jstSkuId: 'jst-001',
      } as any);
      jest.spyOn(jstService, 'createSalesOrder').mockResolvedValue({
        code: 0,
        data: { datas: [{ o_id: 'jst-order-1' }] },
      } as any);

      const result = await service.batchPushJushuitan(['order-1']);

      expect(result.success).toHaveLength(1);
      expect(result.success[0].jushuitanOrderId).toBe('jst-order-1');
      expect(result.failed).toHaveLength(0);
    });

    it('should fail when order is not approved', async () => {
      const mockOrder = {
        id: 'order-1',
        status: SalesOrderStatus.DRAFT,
        salesperson: { jushuitanShopId: 'shop-1' },
        items: [],
      };
      const orderRepo = { findOne: jest.fn().mockResolvedValue(mockOrder) };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });

      const result = await service.batchPushJushuitan(['order-1']);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe(
        'Only approved orders can be pushed',
      );
    });

    it('should fail when salesperson has no Jushuitan shop ID', async () => {
      const mockOrder = {
        id: 'order-1',
        status: SalesOrderStatus.APPROVED,
        salesperson: { id: 'user-1', name: 'Test User', jushuitanShopId: null },
        items: [],
      };
      const orderRepo = { findOne: jest.fn().mockResolvedValue(mockOrder) };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });

      const result = await service.batchPushJushuitan(['order-1']);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toContain('has no Jushuitan shop ID');
    });

    it('should fail when items missing jstSkuId', async () => {
      const mockOrder = {
        id: 'order-1',
        status: SalesOrderStatus.APPROVED,
        salesperson: { jushuitanShopId: 'shop-1' },
        items: [
          {
            skuId: 'sku-1',
            skuName: 'Missing SKU',
            skuCode: null,
            jstSkuId: null,
          },
        ],
        customer: { name: 'Customer' },
      };
      const orderRepo = { findOne: jest.fn().mockResolvedValue(mockOrder) };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });
      jest.spyOn(productsService, 'findSkuById').mockResolvedValue({
        id: 'sku-1',
        skuCode: null,
        jstSkuId: null,
      } as any);

      const result = await service.batchPushJushuitan(['order-1']);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toContain('缺少聚水潭平台编码');
    });

    it('should handle Jushuitan API failure', async () => {
      const mockOrder = {
        id: 'order-1',
        status: SalesOrderStatus.APPROVED,
        salesperson: { jushuitanShopId: 'shop-1' },
        items: [
          {
            skuId: 'sku-1',
            skuName: 'Product',
            skuCode: 'SKU001',
            jstSkuId: 'jst-001',
          },
        ],
        customer: { name: 'Customer' },
      };
      const orderRepo = {
        findOne: jest.fn().mockResolvedValue(mockOrder),
        save: jest.fn(),
      };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });
      jest
        .spyOn(jstService, 'createSalesOrder')
        .mockResolvedValue({ code: 1, msg: 'API Error' } as any);

      const result = await service.batchPushJushuitan(['order-1']);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('API Error');
    });

    it('should handle missing order', async () => {
      const orderRepo = { findOne: jest.fn().mockResolvedValue(null) };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });

      const result = await service.batchPushJushuitan(['order-1']);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toBe('Order not found');
    });
  });

  describe('submitCollectionForApproval', () => {
    it('should submit collection for approved order', async () => {
      const mockOrder = {
        id: 'order-1',
        status: SalesOrderStatus.APPROVED,
        payAmount: 1000,
        collectedAmount: 0,
        prepaymentDeducted: 0,
        customer: { id: 'cust-1', name: 'Test', prepaymentBalance: 500 },
        items: [],
      };
      const orderRepo = {
        findOne: jest.fn().mockResolvedValue(mockOrder),
        save: jest.fn((v) => Promise.resolve(v)),
      };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });
      jest
        .spyOn(approvalService, 'submitCollectionForApproval')
        .mockResolvedValue(undefined);

      const dto = {
        records: [
          { amount: 500, method: 'bank_transfer' },
          { amount: 200, method: 'prepayment' },
        ],
      };

      const result = await service.submitCollectionForApproval(
        'order-1',
        dto,
        'feishu-user-1',
        'code',
      );

      expect(result.status).toBe(SalesOrderStatus.PENDING_APPROVAL);
      expect(approvalService.submitCollectionForApproval).toHaveBeenCalled();
    });

    it('should throw when order status does not allow collection', async () => {
      const mockOrder = {
        id: 'order-1',
        status: SalesOrderStatus.DRAFT,
      };
      const orderRepo = { findOne: jest.fn().mockResolvedValue(mockOrder) };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });

      const dto = { records: [{ amount: 100, method: 'bank_transfer' }] };

      await expect(
        service.submitCollectionForApproval('order-1', dto, 'user', 'code'),
      ).rejects.toThrow('订单状态不允许回款');
    });

    it('should throw when collection exceeds remaining amount', async () => {
      const mockOrder = {
        id: 'order-1',
        status: SalesOrderStatus.APPROVED,
        payAmount: 1000,
        collectedAmount: 800,
        prepaymentDeducted: 0,
        customer: { prepaymentBalance: 0 },
        items: [],
      };
      const orderRepo = { findOne: jest.fn().mockResolvedValue(mockOrder) };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });

      const dto = { records: [{ amount: 300, method: 'bank_transfer' }] };

      await expect(
        service.submitCollectionForApproval('order-1', dto, 'user', 'code'),
      ).rejects.toThrow('回款金额超过剩余应收款');
    });

    it('should throw when prepayment exceeds customer balance', async () => {
      const mockOrder = {
        id: 'order-1',
        status: SalesOrderStatus.APPROVED,
        payAmount: 1000,
        collectedAmount: 0,
        prepaymentDeducted: 0,
        customer: { prepaymentBalance: 100 },
        items: [],
      };
      const orderRepo = { findOne: jest.fn().mockResolvedValue(mockOrder) };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });

      const dto = { records: [{ amount: 200, method: 'prepayment' }] };

      await expect(
        service.submitCollectionForApproval('order-1', dto, 'user', 'code'),
      ).rejects.toThrow('客户预付款余额不足');
    });
  });

  describe('findAll', () => {
    it('should paginate results', async () => {
      const result = await service.findAll(2, 10);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);
    });

    it('should filter by status', async () => {
      const getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
      const orderRepo = {
        createQueryBuilder: jest.fn(() => ({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getManyAndCount,
        })),
      };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });

      await service.findAll(1, 20, { status: 'draft' });

      expect(orderRepo.createQueryBuilder).toHaveBeenCalledWith('order');
      expect(getManyAndCount).toHaveBeenCalled();
    });

    it('should filter by multiple statuses', async () => {
      const getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
      const orderRepo = {
        createQueryBuilder: jest.fn(() => ({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getManyAndCount,
        })),
      };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });

      await service.findAll(1, 20, { status: 'draft,approved' });

      expect(getManyAndCount).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return order with related records', async () => {
      const mockOrder = {
        id: 'order-1',
        status: SalesOrderStatus.DRAFT,
        customer: { name: 'Test' },
        items: [],
        creator: { name: 'User' },
        salesperson: null,
      };
      const orderRepo = { findOne: jest.fn().mockResolvedValue(mockOrder) };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });

      const result = await service.findOne('order-1');

      expect(result.id).toBe('order-1');
      expect(result.approvalRecords).toEqual([]);
      expect(result.deliveryOrders).toEqual([]);
      expect(result.paymentRecords).toEqual([]);
    });

    it('should throw when order not found', async () => {
      const orderRepo = { findOne: jest.fn().mockResolvedValue(null) };
      Object.defineProperty(service, 'orderRepo', {
        value: orderRepo,
        writable: true,
      });

      await expect(service.findOne('invalid')).rejects.toThrow(
        'Sales order not found',
      );
    });
  });
});
