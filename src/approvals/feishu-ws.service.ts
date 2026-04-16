import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import WebSocket from 'ws';
import { FeishuApprovalService } from './feishu-approval.service';
import { ApprovalService } from './approval.service';

@Injectable()
export class FeishuWsService implements OnModuleInit, OnModuleDestroy {
  private ws: WebSocket | null = null;
  private readonly logger = new Logger(FeishuWsService.name);
  private reconnectTimer: any;

  constructor(
    private readonly feishuApproval: FeishuApprovalService,
    private readonly approvalService: ApprovalService,
  ) {}

  async onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.removeAllListeners();
    this.ws?.close();
  }

  private async connect() {
    try {
      const token = await this.feishuApproval.getTenantAccessToken();
      const url = `wss://open.feishu.cn/open-apis/event/v1/outbound/event?access_token=${token}`;
      this.ws = new WebSocket(url);

      this.ws.on('open', () => this.logger.log('Feishu WS connected'));
      this.ws.on('message', (data) => this.handleMessage(data.toString()));
      this.ws.on('close', () => {
        this.logger.warn('Feishu WS closed');
        this.scheduleReconnect();
      });
      this.ws.on('error', (err) => {
        this.logger.error('Feishu WS error', err.message);
        this.scheduleReconnect();
      });
    } catch (e: any) {
      this.logger.error('Feishu WS connect failed', e.message);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 30000);
  }

  private async handleMessage(raw: string) {
    try {
      const msg = JSON.parse(raw);
      this.logger.debug('Feishu WS message', msg);
      if (msg?.event?.type?.includes('approval')) {
        const instanceCode = msg.event.instance_code;
        if (instanceCode) {
          await this.approvalService.handleCallback(instanceCode, msg);
        }
      }
    } catch (e) {
      this.logger.error('Failed to handle WS message', e);
    }
  }
}
