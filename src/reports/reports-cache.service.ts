import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class ReportsCacheService {
  private redis: Redis;
  private readonly DEFAULT_TTL = 300; // 5 minutes

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });
  }

  private buildKey(
    reportType: string,
    userId: string,
    params: Record<string, unknown>,
  ): string {
    const paramHash = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('|');
    return `report:${reportType}:${userId}:${paramHash || 'all'}`;
  }

  async get<T>(
    reportType: string,
    userId: string,
    params: Record<string, unknown>,
  ): Promise<T | null> {
    const key = this.buildKey(reportType, userId, params);
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    return null;
  }

  async set<T>(
    reportType: string,
    userId: string,
    params: Record<string, unknown>,
    data: T,
    ttl = this.DEFAULT_TTL,
  ): Promise<void> {
    const key = this.buildKey(reportType, userId, params);
    await this.redis.setex(key, ttl, JSON.stringify(data));
  }

  async invalidate(reportType?: string): Promise<void> {
    if (reportType) {
      const keys = await this.redis.keys(`report:${reportType}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } else {
      const keys = await this.redis.keys('report:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }
}
