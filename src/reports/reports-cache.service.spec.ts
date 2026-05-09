import { ReportsCacheService } from './reports-cache.service';

describe('ReportsCacheService', () => {
  let service: ReportsCacheService;

  beforeEach(() => {
    service = new ReportsCacheService();
  });

  afterEach(() => {
    // ensure redis connection cleaned up
    (service as any).redis?.disconnect?.();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildKey', () => {
    const buildKey = (
      svc: ReportsCacheService,
      ...args: [string, string, Record<string, unknown>]
    ) => (svc as any).buildKey.call(svc, ...args);

    it('includes report type and user id', () => {
      const key = buildKey(service, 'sales', 'u1', {});
      expect(key).toBe('report:sales:u1:all');
    });

    it('sorts params alphabetically', () => {
      const key = buildKey(service, 'sales', 'u1', { z: 1, a: 2, m: 3 });
      expect(key).toBe('report:sales:u1:a=2|m=3|z=1');
    });

    it('ignores null, undefined, and empty string values', () => {
      const key = buildKey(service, 'sales', 'u1', {
        a: 1,
        b: null,
        c: undefined,
        d: '',
        e: 2,
      });
      expect(key).toBe('report:sales:u1:a=1|e=2');
    });

    it('handles booleans and numbers', () => {
      const key = buildKey(service, 'stock', 'u2', {
        active: true,
        limit: 10,
      });
      expect(key).toBe('report:stock:u2:active=true|limit=10');
    });
  });
});
