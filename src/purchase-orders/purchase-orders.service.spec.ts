import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PurchaseOrdersService } from './purchase-orders.service';
import {
  PurchaseOrder,
  PurchaseOrderStatus,
} from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { ApprovalService } from '../approvals/approval.service';
import { PurchaseOrderStatusLogsService } from './purchase-order-status-logs.service';

describe('PurchaseOrdersService', () => {
  let itemRepo: jest.Mocked<Repository<PurchaseOrderItem>>;
  let supplierRepo: jest.Mocked<Repository<Supplier>>;
  let service: PurchaseOrdersService;
  let statusLogsService: PurchaseOrderStatusLogsService;
  let orderRepo: jest.Mocked<Repository<PurchaseOrder>>;

  const mockOrderRepo = () => ({
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn().mockImplementation((o) => Promise.resolve(o)),
    create: jest.fn().mockImplementation((o) => o as PurchaseOrder),
    count: jest.fn().mockResolvedValue(0),
    remove: jest.fn().mockResolvedValue(undefined),
  });

  const mockItemRepo = () => ({
    create: jest.fn().mockImplementation((o) => o as PurchaseOrderItem),
    save: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  });

  const mockSupplierRepo = () => ({
    findOneBy: jest.fn(),
  });

  const dataSourceMock = {
    transaction: jest.fn().mockImplementation(async (fn) => {
      const manager = {
        getRepository: jest.fn().mockImplementation((entity) => {
          if (entity === PurchaseOrder && orderRepo) {
            return orderRepo;
          }
          return {
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            save: jest.fn().mockImplementation((o) => Promise.resolve(o)),
            remove: jest.fn().mockResolvedValue(undefined),
            create: jest.fn().mockImplementation((o) => o),
          };
        }),
        findOne: jest.fn(),
      };
      return fn(manager as any);
    }),
  };

  const mockApprovalService = () => ({
    submitPurchaseOrderForApproval: jest.fn().mockResolvedValue({
      feishuInstanceCode: 'instance-1',
    }),
  });

  const mockStatusLogsService = () => ({
    create: jest.fn().mockResolvedValue({}),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        {
          provide: getRepositoryToken(PurchaseOrder),
          useValue: mockOrderRepo(),
        },
        {
          provide: getRepositoryToken(PurchaseOrderItem),
          useValue: mockItemRepo(),
        },
        { provide: getRepositoryToken(Supplier), useValue: mockSupplierRepo() },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: ApprovalService, useValue: mockApprovalService() },
        {
          provide: PurchaseOrderStatusLogsService,
          useValue: mockStatusLogsService(),
        },
      ],
    }).compile();

    service = module.get(PurchaseOrdersService);
    statusLogsService = module.get(PurchaseOrderStatusLogsService);
    orderRepo = module.get(getRepositoryToken(PurchaseOrder));
    itemRepo = module.get(getRepositoryToken(PurchaseOrderItem));
    supplierRepo = module.get(getRepositoryToken(Supplier));
  });

  describe('create', () => {
    it('should preserve skuCode and skuName from dto items', async () => {
      supplierRepo.findOneBy.mockResolvedValue({
        id: 's1',
        name: '供应商A',
        isActive: true,
      } as Supplier);

      await service.create({
        supplierId: 's1',
        items: [
          {
            skuId: 'sku-uuid-1',
            skuCode: 'SKU001',
            skuName: '原材料A',
            qty: 10,
            unitPrice: 100,
          },
        ],
      });

      expect(itemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          skuId: 'sku-uuid-1',
          skuCode: 'SKU001',
          skuName: '原材料A',
        }),
      );
    });
  });

  describe('submitForApproval', () => {
    it('should log status change from draft to pending_approval', async () => {
      const order = {
        id: 'po1',
        status: PurchaseOrderStatus.DRAFT,
        orderNo: 'CG-20250101-001',
        supplierId: 's1',
        items: [],
      } as PurchaseOrder;

      orderRepo.findOne.mockResolvedValueOnce(order);

      await service.submitForApproval('po1', 'user1', 'approval-code');

      expect(statusLogsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          purchaseOrderId: 'po1',
          fromStatus: 'draft',
          toStatus: 'pending_approval',
        }),
      );
    });
  });

  describe('receive', () => {
    it('should log status change when order becomes partial_received', async () => {
      const item = {
        id: 'item1',
        skuId: 'sku1',
        skuName: '原材料A',
        qty: 10,
        receivedQty: 0,
      } as PurchaseOrderItem;

      const order = {
        id: 'po1',
        status: PurchaseOrderStatus.APPROVED,
        items: [item],
      } as PurchaseOrder;

      orderRepo.findOne.mockResolvedValueOnce(order);

      await service.receive('po1', {
        items: [{ itemId: 'item1', receiveQty: 5 }],
      });

      expect(statusLogsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          purchaseOrderId: 'po1',
          fromStatus: 'approved',
          toStatus: 'partial_received',
          remark: '到货入库: 原材料A +5',
        }),
        expect.anything(),
      );
    });

    it('should log status change when order becomes received', async () => {
      const item = {
        id: 'item1',
        skuId: 'sku1',
        skuName: '原材料A',
        qty: 10,
        receivedQty: 0,
      } as PurchaseOrderItem;

      const order = {
        id: 'po1',
        status: PurchaseOrderStatus.PARTIAL_RECEIVED,
        items: [item],
      } as PurchaseOrder;

      orderRepo.findOne.mockResolvedValueOnce(order);

      await service.receive('po1', {
        items: [{ itemId: 'item1', receiveQty: 10 }],
      });

      expect(statusLogsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          purchaseOrderId: 'po1',
          fromStatus: 'partial_received',
          toStatus: 'received',
          remark: '到货入库: 原材料A +10',
        }),
        expect.anything(),
      );
    });
  });
});
