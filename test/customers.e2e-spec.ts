import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import request from 'supertest';
import { CustomersController } from '../src/customers/customers.controller';
import { CustomersService } from '../src/customers/customers.service';
import { ExportService } from '../src/common/services/export.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

class MockGuard implements CanActivate {
  canActivate() {
    return true;
  }
}

describe('CustomersController (e2e)', () => {
  let app: INestApplication;
  const mockService = {
    findAll: jest
      .fn()
      .mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 20 }),
    findOne: jest.fn(),
    create: jest
      .fn()
      .mockImplementation((dto) => Promise.resolve({ id: 'c1', ...dto })),
    update: jest.fn(),
    remove: jest.fn(),
    batchCreate: jest.fn().mockResolvedValue({ imported: 1 }),
  };
  const mockExportService = {
    exportToExcel: jest.fn().mockResolvedValue(Buffer.from('test-excel')),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        { provide: CustomersService, useValue: mockService },
        { provide: ExportService, useValue: mockExportService },
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

  it('/customers (GET) - returns paginated list', async () => {
    const customers = [
      { id: 'c1', name: '客户A', isActive: true },
      { id: 'c2', name: '客户B', isActive: true },
    ];
    mockService.findAll.mockResolvedValueOnce({
      data: customers,
      total: 2,
      page: 1,
      pageSize: 20,
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/customers')
      .query({ page: 1, pageSize: 20 })
      .expect(200);

    expect(res.body.code).toBe(0);
    expect(res.body.data.data).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
  });

  it('/customers (POST) - creates customer', async () => {
    const payload = {
      name: '新客户',
      contactName: '张三',
      phone: '13800138000',
    };
    mockService.create.mockResolvedValueOnce({ id: 'c3', ...payload });

    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .send(payload)
      .expect(201);

    expect(res.body.code).toBe(0);
    expect(mockService.create).toHaveBeenCalled();
  });

  it('/customers/:id (PUT) - updates customer', async () => {
    const payload = { name: '更新后' };

    const res = await request(app.getHttpServer())
      .put('/api/v1/customers/c1')
      .send(payload)
      .expect(200);

    expect(res.body.code).toBe(0);
    expect(mockService.update).toHaveBeenCalledWith('c1', expect.any(Object));
  });

  it('/customers/:id (DELETE) - removes customer', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/v1/customers/c1')
      .expect(200);

    expect(res.body.code).toBe(0);
    expect(mockService.remove).toHaveBeenCalledWith('c1');
  });

  it('/customers/export (GET) - returns excel buffer', async () => {
    mockService.findAll.mockResolvedValueOnce({
      data: [{ id: 'c1', name: '客户A' }],
      total: 1,
      page: 1,
      pageSize: 10000,
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/customers/export')
      .expect(200);

    expect(res.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toContain('customers-');
    expect(mockExportService.exportToExcel).toHaveBeenCalled();
  });
});
