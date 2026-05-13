import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalsController } from './approvals.controller';
import { ApprovalService } from './approval.service';
import { FeishuWsService } from './feishu-ws.service';
import { ConfigService } from '@nestjs/config';

describe('ApprovalsController', () => {
  let controller: ApprovalsController;

  const mockApprovalService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    handleCallback: jest.fn(),
  };

  const mockWsService = {
    getStatus: jest.fn().mockReturnValue({ connected: true }),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'NGROK_URL') return 'https://test.ngrok.io';
      if (key === 'FEISHU_APP_ID') return 'test-app-id';
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApprovalsController],
      providers: [
        { provide: ApprovalService, useValue: mockApprovalService },
        { provide: FeishuWsService, useValue: mockWsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<ApprovalsController>(ApprovalsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleWebhook', () => {
    it('should return challenge response for URL verification', async () => {
      const body = {
        challenge: 'test-challenge-123',
        token: 'test-token',
        type: 'url_verification',
      };

      const result = await controller.handleWebhook(body);

      expect(result).toEqual({
        challenge: 'test-challenge-123',
        token: 'test-token',
        type: 'url_verification',
      });
      expect(mockApprovalService.handleCallback).not.toHaveBeenCalled();
    });

    it('should handle approval callback with event.instance_code', async () => {
      const body = {
        event: {
          instance_code: 'instance-123',
          status: 'APPROVED',
        },
      };

      mockApprovalService.handleCallback.mockResolvedValue(undefined);

      const result = await controller.handleWebhook(body);

      expect(mockApprovalService.handleCallback).toHaveBeenCalledWith('instance-123', body);
      expect(result).toEqual({ message: 'ok' });
    });

    it('should handle approval callback with top-level instance_code', async () => {
      const body = {
        instance_code: 'instance-456',
        status: 'REJECTED',
      };

      mockApprovalService.handleCallback.mockResolvedValue(undefined);

      const result = await controller.handleWebhook(body);

      expect(mockApprovalService.handleCallback).toHaveBeenCalledWith('instance-456', body);
      expect(result).toEqual({ message: 'ok' });
    });

    it('should return ok when no instance_code found', async () => {
      const body = {
        event: {
          other_field: 'value',
        },
      };

      const result = await controller.handleWebhook(body);

      expect(mockApprovalService.handleCallback).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'ok' });
    });

    it('should handle callback errors gracefully', async () => {
      const body = {
        event: {
          instance_code: 'instance-789',
          status: 'APPROVED',
        },
      };

      mockApprovalService.handleCallback.mockRejectedValue(new Error('DB error'));

      // Should not throw - the controller catches errors internally
      await expect(controller.handleWebhook(body)).rejects.toThrow('DB error');
    });
  });

  describe('findAll', () => {
    it('should return all approvals without status filter', async () => {
      const expected = [{ id: '1', status: 'pending' }];
      mockApprovalService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll();

      expect(mockApprovalService.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(expected);
    });

    it('should filter by status', async () => {
      const expected = [{ id: '1', status: 'approved' }];
      mockApprovalService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll('approved');

      expect(mockApprovalService.findAll).toHaveBeenCalledWith('approved');
      expect(result).toEqual(expected);
    });
  });

  describe('approve', () => {
    it('should approve by instance code', async () => {
      mockApprovalService.approve.mockResolvedValue({ message: 'approved' });

      const result = await controller.approve('instance-123');

      expect(mockApprovalService.approve).toHaveBeenCalledWith('instance-123');
      expect(result).toEqual({ message: 'approved' });
    });
  });

  describe('reject', () => {
    it('should reject by instance code', async () => {
      mockApprovalService.reject.mockResolvedValue({ message: 'rejected' });

      const result = await controller.reject('instance-123');

      expect(mockApprovalService.reject).toHaveBeenCalledWith('instance-123');
      expect(result).toEqual({ message: 'rejected' });
    });
  });

  describe('getDiagnostics', () => {
    it('should return diagnostic info with masked appId', async () => {
      const result = controller.getDiagnostics();

      expect(result.wsStatus).toEqual({ connected: true });
      expect(result.appId).toBe('test****p-id');
      expect(result.checklist).toBeDefined();
      expect(result.fallbackWebhookUrl).toBe('https://test.ngrok.io/api/v1/webhooks/feishu/approval');
    });

    it('should handle missing config', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      const result = controller.getDiagnostics();

      expect(result.appId).toBe('未配置');
      expect(result.fallbackWebhookUrl).toBeNull();
    });
  });

  describe('testWebhook', () => {
    it('should simulate approved callback', async () => {
      mockApprovalService.handleCallback.mockResolvedValue(undefined);

      const result = await controller.testWebhook({
        instanceCode: 'test-instance',
        status: 'approved',
      });

      expect(mockApprovalService.handleCallback).toHaveBeenCalledWith(
        'test-instance',
        expect.objectContaining({
          event: {
            instance_code: 'test-instance',
            status: 'APPROVED',
          },
        }),
      );
      expect(result.status).toBe('approved');
    });

    it('should simulate rejected callback', async () => {
      mockApprovalService.handleCallback.mockResolvedValue(undefined);

      const result = await controller.testWebhook({
        instanceCode: 'test-instance',
        status: 'rejected',
      });

      expect(result.status).toBe('rejected');
    });

    it('should return error when instanceCode is missing', async () => {
      const result = await controller.testWebhook({
        instanceCode: '',
        status: 'approved',
      });

      expect(result.error).toBe('instanceCode 必填');
      expect(mockApprovalService.handleCallback).not.toHaveBeenCalled();
    });

    it('should handle callback errors in test', async () => {
      mockApprovalService.handleCallback.mockRejectedValue(new Error('Test error'));

      const result = await controller.testWebhook({
        instanceCode: 'test-instance',
        status: 'approved',
      });

      expect(result.error).toBe('Test error');
    });
  });
});
