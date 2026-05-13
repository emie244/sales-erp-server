import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { JushuitanService } from './jushuitan.service';
import { SalesOrder } from '../sales/entities/sales-order.entity';
import { SalesOrderStatus } from '../sales/entities/sales-order.entity';

jest.mock('fs');

describe('JushuitanService', () => {
  let service: JushuitanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JushuitanService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                JUSHUITAN_APP_KEY: 'test-key',
                JUSHUITAN_APP_SECRET: 'test-secret',
                JUSHUITAN_ACCESS_TOKEN: 'test-token',
                JUSHUITAN_REFRESH_TOKEN: 'test-refresh',
                JUSHUITAN_SHOP_ID: '100',
              };
              return map[key] || '';
            }),
          },
        },
      ],
    }).compile();

    service = module.get<JushuitanService>(JushuitanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sign', () => {
    it('produces stable MD5 sign', () => {
      const sign = (service as any).sign.bind(service);
      const result = sign({ foo: 'bar', baz: 123 });
      expect(typeof result).toBe('string');
      expect(result).toHaveLength(32);
      expect(result).toMatch(/^[a-f0-9]{32}$/);
    });

    it('ignores null/empty values and sign key itself', () => {
      const sign = (service as any).sign.bind(service);
      const result = sign({
        a: '1',
        b: null,
        c: '',
        sign: 'ignored',
      });
      expect(typeof result).toBe('string');
      expect(result).toHaveLength(32);
    });
  });

  describe('buildSalesOrderPayload', () => {
    it('throws when signer is missing', () => {
      const order = {
        id: 'order-1',
        status: SalesOrderStatus.APPROVED,
        createdAt: new Date(),
        payAmount: 100,
        customerId: 'c1',
      } as unknown as SalesOrder;

      expect(() => service.buildSalesOrderPayload(order)).toThrow(
        /未指定签单人/,
      );
    });

    it('throws when signer has no jushuitanShopId', () => {
      const order = {
        id: 'order-1',
        status: SalesOrderStatus.APPROVED,
        createdAt: new Date(),
        payAmount: 100,
        customerId: 'c1',
        signer: { name: 'Alice' },
      } as unknown as SalesOrder;

      expect(() => service.buildSalesOrderPayload(order)).toThrow(
        /未配置聚水潭店铺ID/,
      );
    });

    it('builds payload with correct fields', () => {
      const order = {
        id: 'order-1',
        status: SalesOrderStatus.APPROVED,
        createdAt: new Date('2025-06-01T10:00:00Z'),
        payAmount: 100,
        customerId: 'c1',
        customer: { name: 'Test Customer' },
        consignee: 'Receiver',
        consigneePhone: '13800138000',
        consigneeAddress: 'Some Address',
        consigneeProvince: '广东省',
        consigneeCity: '广州市',
        consigneeDistrict: '天河区',
        signer: { name: 'Alice', jushuitanShopId: '200' },
        items: [
          {
            skuId: 'sku-1',
            skuCode: 'SKU001',
            jstSkuId: 'jst-1',
            skuName: 'Product A',
            productName: 'Product A Name',
            qty: 2,
            unitPrice: 50,
            lineAmount: 100,
          },
        ],
      } as unknown as SalesOrder;

      const payload = service.buildSalesOrderPayload(order);
      expect(payload.so_id).toBe('order-1');
      expect(payload.shop_id).toBe(200);
      expect(payload.receiver_name).toBe('Receiver');
      expect(payload.receiver_mobile).toBe('13800138000');
      expect(payload.receiver_state).toBe('广东省');
      expect(payload.receiver_city).toBe('广州市');
      expect(payload.items).toHaveLength(1);
      expect((payload.items as unknown[])[0]).toMatchObject({
        sku_id: 'jst-1',
        shop_sku_id: 'SKU001',
        qty: 2,
        price: 50,
        amount: 100,
      });
    });

    it('adds default item when order has no items', () => {
      const order = {
        id: 'order-2',
        status: SalesOrderStatus.APPROVED,
        createdAt: new Date(),
        payAmount: 50,
        customerId: 'c1',
        signer: { name: 'Bob', jushuitanShopId: '300' },
      } as unknown as SalesOrder;

      const payload = service.buildSalesOrderPayload(order);
      expect(payload.items).toHaveLength(1);
      expect((payload.items as unknown[])[0]).toMatchObject({
        sku_id: 'UNKNOWN',
        qty: 1,
        price: 50,
      });
    });
  });

  describe('token auto-refresh', () => {
    let fetchMock: jest.Mock;

    beforeEach(() => {
      fetchMock = jest.fn();
      global.fetch = fetchMock;
      jest.clearAllMocks();
    });

    const mockResponse = (body: unknown) => {
      const text = JSON.stringify(body);
      return {
        text: async () => text,
        json: async () => body,
      };
    };

    it('refreshes token and retries on invalid access_token', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse({ code: 104, msg: 'invalid access_token' }),
        )
        .mockResolvedValueOnce(
          mockResponse({
            code: 0,
            data: { access_token: 'new-token', refresh_token: 'new-refresh' },
          }),
        )
        .mockResolvedValueOnce(mockResponse({ code: 0, data: { datas: [] } }));

      const result = await (service as any).request(
        '/open/deliveries/query',
        { page_index: 1, page_size: 50 },
      );

      expect(result.code).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(3);

      const retryCall = fetchMock.mock.calls[2];
      const retryBody = retryCall[1].body as string;
      expect(retryBody).toContain('new-token');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('throws when refresh fails', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockResponse({ code: 104, msg: 'invalid access_token' }),
        )
        .mockResolvedValueOnce(
          mockResponse({ code: 400, msg: 'refresh_token expired' }),
        );

      await expect(
        (service as any).request('/open/deliveries/query', {
          page_index: 1,
          page_size: 50,
        }),
      ).rejects.toThrow(/refresh failed/);
    });

    it('returns result directly when token is valid', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ code: 0, data: { inventorys: [], page_count: 1 } }),
      );

      const result = await (service as any).request('/open/inventory/query', {
        page_index: 1,
        page_size: 100,
      });

      expect(result.code).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
