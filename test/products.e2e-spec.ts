import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import request from 'supertest';
import { ProductsController } from '../src/products/products.controller';
import { ProductsService } from '../src/products/products.service';
import { ExportService } from '../src/common/services/export.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

class MockGuard implements CanActivate {
  canActivate() {
    return true;
  }
}

describe('ProductsController (e2e)', () => {
  let app: INestApplication;
  const mockService = {
    findAll: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20 }),
    findAllSkus: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 50 }),
    findSkusByProductId: jest.fn().mockResolvedValue([]),
    findSkuById: jest.fn(),
    getPrice: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 'p1', ...dto })),
    update: jest.fn(),
    setPrice: jest.fn(),
  };
  const mockExportService = {
    exportToExcel: jest.fn().mockResolvedValue(Buffer.from('test-excel')),
  };
  const mockQueue = {
    add: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        { provide: ProductsService, useValue: mockService },
        { provide: ExportService, useValue: mockExportService },
        { provide: getQueueToken('jushuitan-sync'), useValue: mockQueue },
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

  it('/products (GET) - returns paginated product list', async () => {
    const products = [
      { id: 'p1', name: '产品A', skus: [{ id: 's1', skuCode: 'SKU001' }] },
    ];
    mockService.findAll.mockResolvedValueOnce({ data: products, total: 1, page: 1, pageSize: 20 });

    const res = await request(app.getHttpServer())
      .get('/api/v1/products')
      .query({ page: 1, pageSize: 20 })
      .expect(200);

    expect(res.body.code).toBe(0);
    expect(res.body.data.data).toHaveLength(1);
  });

  it('/products/export (GET) - returns excel buffer', async () => {
    mockService.findAll.mockResolvedValueOnce({
      data: [{ id: 'p1', name: '产品A', skus: [] }],
      total: 1,
      page: 1,
      pageSize: 10000,
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/products/export')
      .expect(200);

    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toContain('products-');
  });

  it('/products/sync-jushuitan (POST) - triggers sync', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/products/sync-jushuitan')
      .expect(201);

    expect(res.body.code).toBe(0);
    expect(mockQueue.add).toHaveBeenCalledWith('sync-skus', { daysBack: 3650 });
  });
});
