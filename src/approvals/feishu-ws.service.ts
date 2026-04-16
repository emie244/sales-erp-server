import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Lark from '@larksuiteoapi/node-sdk';
import { ApprovalService } from './approval.service';

@Injectable()
export class FeishuWsService implements OnModuleInit, OnModuleDestroy {
  private wsClient: Lark.WSClient | null = null;
  private readonly logger = new Logger(FeishuWsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly approvalService: ApprovalService,
  ) {}

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
      loggerLevel: Lark.LoggerLevel.info,
    });

    this.wsClient.start({
      eventDispatcher: new Lark.EventDispatcher({}).register({
        approval_instance: async (data: any) => {
          this.logger.log(
            'Received approval_instance event',
            JSON.stringify(data),
          );
          const instanceCode = data?.instance_code;
          if (instanceCode) {
            await this.approvalService.handleCallback(instanceCode, {
              event: {
                status: data?.status,
                instance_code: instanceCode,
              },
            });
          }
        },
      }),
    });
  }

  onModuleDestroy() {
    // SDK WSClient does not expose a public stop method;
    // the connection will be closed when the process exits.
    this.wsClient = null;
  }
}
