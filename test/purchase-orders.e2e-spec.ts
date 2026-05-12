import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { PurchaseOrdersController } from '../src/purchase-orders/purchase-orders.controller';
import { PurchaseOrdersService } from '../src/purchase-orders/purchase-orders.service';
import { PurchaseOrderStatusLogsService } from '../src/purchase-orders/purchase-order-status-logs.service';
import { ExportService } from '../src/common/services/export.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

class MockGuard implements CanActivate {
  canActivate() {
    return true;
  }
}

describe('PurchaseOrdersController (e2e)', () => {
  let app: INestApplication;
  const mockStatusLogsService = {
    findByPurchaseOrderId: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
  };
  const mockService = {
    findAll: jest
      .fn()
      .mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20 }),
    findOne: jest.fn(),
    create: jest
      .fn()
      .mockImplementation((dto) => Promise.resolve({ id: 'po1', ...dto })),
    update: jest.fn(),
    remove: jest.fn(),
    submitForApproval: jest.fn(),
    receive: jest.fn(),
  };
  const mockExportService = {
    exportToExcel: jest.fn().mockResolvedValue(Buffer.from('test-excel')),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrdersController],
      providers: [
        { provide: PurchaseOrdersService, useValue: mockService },
        { provide: ExportService, useValue: mockExportService },
        {
          provide: PurchaseOrderStatusLogsService,
          useValue: mockStatusLogsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(new MockGuard())
      .overrideGuard(PermissionsGuard)
      .useValue(new MockGuard())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('/purchase-orders (GET) - returns paginated list with filters', async () => {
    const orders = [
      {
        id: 'po1',
        orderNo: 'CG-20250101-001',
        status: 'draft',
        totalAmount: 1000,
        supplier: { name: '供应商A' },
      },
    ];
    mockService.findAll.mockResolvedValueOnce({
      data: orders,
      total: 1,
      page: 1,
      pageSize: 20,
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/purchase-orders')
      .query({ page: 1, pageSize: 20, status: 'draft' })
      .expect(200);

    expect(res.body.code).toBe(0);
    expect(res.body.data.data).toHaveLength(1);
  });

  it('/purchase-orders (POST) - creates purchase order', async () => {
    const payload = {
      supplierId: 's1',
      items: [{ skuId: 'sku1', qty: 10, unitPrice: 100 }],
    };
    mockService.create.mockResolvedValueOnce({ id: 'po1', ...payload });

    const res = await request(app.getHttpServer())
      .post('/api/v1/purchase-orders')
      .send(payload)
      .expect(201);

    expect(res.body.code).toBe(0);
    expect(mockService.create).toHaveBeenCalled();
  });

  it('/purchase-orders/:id (GET) - returns purchase order detail', async () => {
    const order = {
      id: 'po1',
      orderNo: 'CG-20250101-001',
      supplierId: 's1',
      supplierName: '供应商A',
      status: 'approved',
      totalAmount: 5000,
      remark: '测试采购单',
      items: [
        {
          id: 'item1',
          skuId: 'sku1',
          skuCode: 'SKU-001',
          skuName: '测试产品',
          qty: 10,
          receivedQty: 0,
          unitPrice: 500,
          lineAmount: 5000,
          remark: '',
        },
      ],
      createdAt: '2025-01-01T00:00:00Z',
    };
    mockService.findOne.mockResolvedValueOnce(order);

    const res = await request(app.getHttpServer())
      .get('/api/v1/purchase-orders/po1')
      .expect(200);

    expect(res.body.code).toBe(0);
    expect(res.body.data.id).toBe('po1');
    expect(res.body.data.orderNo).toBe('CG-20250101-001');
    expect(res.body.data.items).toHaveLength(1);
    expect(mockService.findOne).toHaveBeenCalledWith('po1');
  });

  it('/purchase-orders/export (GET) - returns excel buffer with filters', async () => {
    mockService.findAll.mockResolvedValueOnce({
      data: [
        { id: 'po1', orderNo: 'CG-001', status: 'draft', totalAmount: 100 },
      ],
      total: 1,
      page: 1,
      pageSize: 10000,
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/purchase-orders/export')
      .query({ status: 'draft' })
      .expect(200);

    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toContain('purchase-orders-');
  });

  it('/purchase-orders/:id/status-logs (GET) - returns status logs', async () => {
    const logs = [
      {
        id: 'log1',
        purchaseOrderId: 'po1',
        fromStatus: 'draft',
        toStatus: 'pending_approval',
        remark: '提交审批',
      },
      {
        id: 'log2',
        purchaseOrderId: 'po1',
        fromStatus: 'pending_approval',
        toStatus: 'approved',
        remark: '审批通过',
      },
    ];
    mockStatusLogsService.findByPurchaseOrderId.mockResolvedValueOnce(logs);

    const res = await request(app.getHttpServer())
      .get('/api/v1/purchase-orders/po1/status-logs')
      .expect(200);

    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveLength(2);
    expect(mockStatusLogsService.findByPurchaseOrderId).toHaveBeenCalledWith(
      'po1',
    );
  });
});
