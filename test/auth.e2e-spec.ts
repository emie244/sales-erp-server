import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/permissions.guard';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

class MockGuard implements CanActivate {
  canActivate() {
    return true;
  }
}

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  const mockAuthService = {
    login: jest
      .fn()
      .mockResolvedValue({ token: 'test-token', user: { name: 'admin' } }),
    feishuCallback: jest.fn(),
  };
  const mockConfigService = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        FEISHU_APP_ID: 'test-app-id',
        NGROK_URL: 'http://localhost:3000',
      };
      return map[key] || '';
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
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

  it('/auth/login (POST) - success', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(201)
      .expect((res) => {
        expect(res.body.code).toBe(0);
        expect(res.body.data.token).toBe('test-token');
      });
  });

  it('/auth/login (POST) - calls service with credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(201);
    expect(mockAuthService.login).toHaveBeenCalledWith('admin', 'admin123');
  });

  it('/auth/feishu/login (GET) - returns redirect url', () => {
    return request(app.getHttpServer())
      .get('/api/v1/auth/feishu/login')
      .expect(200)
      .expect((res) => {
        expect(res.body.code).toBe(0);
        expect(res.body.data.url).toContain('accounts.feishu.cn');
      });
  });
});
