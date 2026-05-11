import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseOrderStatusLogsService } from './purchase-order-status-logs.service';
import { PurchaseOrderStatusLog } from './entities/purchase-order-status-log.entity';

describe('PurchaseOrderStatusLogsService', () => {
  let service: PurchaseOrderStatusLogsService;
  let repo: Repository<PurchaseOrderStatusLog>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderStatusLogsService,
        {
          provide: getRepositoryToken(PurchaseOrderStatusLog),
          useValue: {
            create: jest.fn().mockImplementation((dto) => ({ id: 'log1', ...dto })),
            save: jest.fn().mockImplementation((log) => Promise.resolve(log)),
            find: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get(PurchaseOrderStatusLogsService);
    repo = module.get(getRepositoryToken(PurchaseOrderStatusLog));
  });

  it('should create a status log when order is submitted for approval', async () => {
    const result = await service.create({
      purchaseOrderId: 'po1',
      fromStatus: 'draft',
      toStatus: 'pending_approval',
      operatorId: 'user1',
      remark: '提交审批',
    });

    expect(repo.create).toHaveBeenCalledWith({
      purchaseOrderId: 'po1',
      fromStatus: 'draft',
      toStatus: 'pending_approval',
      operatorId: 'user1',
      remark: '提交审批',
    });
    expect(repo.save).toHaveBeenCalled();
    expect(result.purchaseOrderId).toBe('po1');
    expect(result.toStatus).toBe('pending_approval');
  });

  it('should find logs by purchase order id ordered by creation time', async () => {
    const logs = [
      { id: 'log1', purchaseOrderId: 'po1', toStatus: 'pending_approval' },
      { id: 'log2', purchaseOrderId: 'po1', toStatus: 'approved' },
    ];
    (repo.find as jest.Mock).mockResolvedValue(logs);

    const result = await service.findByPurchaseOrderId('po1');

    expect(repo.find).toHaveBeenCalledWith({
      where: { purchaseOrderId: 'po1' },
      order: { createdAt: 'DESC' },
    });
    expect(result).toHaveLength(2);
  });
});
