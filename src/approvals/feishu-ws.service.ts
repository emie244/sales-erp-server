import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Lark from '@larksuiteoapi/node-sdk';
import { ApprovalService } from './approval.service';

export interface WsConnectionStatus {
  connected: boolean;
  connectedAt: Date | null;
  lastEventAt: Date | null;
  lastEventType: string | null;
  totalEvents: number;
  errorCount: number;
  lastError: string | null;
}

@Injectable()
export class FeishuWsService implements OnModuleInit, OnModuleDestroy {
  private wsClient: Lark.WSClient | null = null;
  private readonly logger = new Logger(FeishuWsService.name);
  private status: WsConnectionStatus = {
    connected: false,
    connectedAt: null,
    lastEventAt: null,
    lastEventType: null,
    totalEvents: 0,
    errorCount: 0,
    lastError: null,
  };
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly approvalService: ApprovalService,
  ) {}

  getStatus(): WsConnectionStatus {
    return { ...this.status };
  }

  async onModuleInit() {
    const appId = this.config.get<string>('FEISHU_APP_ID') || '';
    const appSecret = this.config.get<string>('FEISHU_APP_SECRET') || '';

    if (!appId || !appSecret) {
      this.logger.warn('Feishu credentials not configured, skipping WS client');
      return;
    }

    const baseConfig = { appId, appSecret };
    this.wsClient = new Lark.WSClient({
      ...baseConfig,
      loggerLevel: Lark.LoggerLevel.debug,
    });

    const dispatcher = new Lark.EventDispatcher({});

    // 通用调试 handler：捕获所有事件并打印事件名
    const originalInvoke = (dispatcher as any).invoke.bind(dispatcher);
    (dispatcher as any).invoke = async (data: any, params: any) => {
      const eventName = data?.header?.event_type || data?.type || 'unknown';
      this.status.lastEventAt = new Date();
      this.status.lastEventType = eventName;
      this.status.totalEvents++;
      this.logger.log(
        `[WS Debug] Received event: ${eventName}, data: ${JSON.stringify(data).slice(0, 500)}`,
      );
      return originalInvoke(data, params);
    };

    dispatcher.register({
      // 审批实例事件（多种可能的名称）
      approval_instance: async (data: any) => {
        this.logger.log('Handler approval_instance triggered');
        await this.handleApprovalEvent(data);
      },
      'approval.instance': async (data: any) => {
        this.logger.log('Handler approval.instance triggered');
        await this.handleApprovalEvent(data);
      },
      // 兜底：如果事件名是其他格式
      '*': async (data: any) => {
        this.logger.log('Handler * (catch-all) triggered');
        await this.handleApprovalEvent(data);
      },
    });

    try {
      this.wsClient.start({ eventDispatcher: dispatcher });
      this.status.connected = true;
      this.status.connectedAt = new Date();
      this.logger.log('Feishu WS client started');
    } catch (err: any) {
      this.status.connected = false;
      this.status.errorCount++;
      this.status.lastError = err.message;
      this.logger.error('Failed to start Feishu WS client:', err.message);
    }

    // 每 30 秒检查一次连接健康状态
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, 30000);
  }

  private checkHealth() {
    if (!this.wsClient) {
      this.status.connected = false;
      return;
    }
    // WSClient 没有公开 isConnected 方法，通过最后事件时间判断
    const idleMs = this.status.lastEventAt
      ? Date.now() - this.status.lastEventAt.getTime()
      : Date.now() - (this.status.connectedAt?.getTime() || Date.now());
    this.logger.debug(
      `WS health check: idle=${Math.round(idleMs / 1000)}s, events=${this.status.totalEvents}`,
    );
  }

  private async handleApprovalEvent(data: any) {
    const instanceCode = data?.instance_code || data?.event?.instance_code;
    const status = data?.status || data?.event?.status;
    if (instanceCode) {
      this.logger.log(
        `[WS] Processing approval event: instance=${instanceCode}, status=${status}`,
      );
      try {
        await this.approvalService.handleCallback(instanceCode, {
          event: {
            status,
            instance_code: instanceCode,
          },
        });
      } catch (err: any) {
        this.status.errorCount++;
        this.status.lastError = err.message;
        this.logger.error(
          `[WS] Failed to handle approval event: ${err.message}`,
        );
      }
    } else {
      this.logger.warn(
        `[WS] No instance_code in event: ${JSON.stringify(data).slice(0, 200)}`,
      );
    }
  }

  onModuleDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.wsClient = null;
    this.status.connected = false;
  }
}
