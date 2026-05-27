import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrder } from '../entities/sales-order.entity';
import { ApprovalRecord } from '../../approvals/entities/approval-record.entity';
import { PaymentRecord } from '../../payments/entities/payment-record.entity';
import { DeliveryOrder } from '../../deliveries/entities/delivery-order.entity';
import { ProductionOrder } from '../../production-orders/entities/production-order.entity';
import { PurchaseRequest } from '../../purchase-requests/entities/purchase-request.entity';
import { PurchaseOrder } from '../../purchase-orders/entities/purchase-order.entity';
import { InvoiceRecord } from '../../invoices/entities/invoice-record.entity';
import { Voucher } from '../../vouchers/entities/voucher.entity';

export interface OrderTrackingEvent {
  stage: string;
  stageLabel: string;
  status: 'finish' | 'process' | 'wait' | 'error';
  date: string | null;
  description: string;
  details: any[];
}

export interface OrderTrackingResult {
  orderId: string;
  orderNo: string | null;
  status: string;
  timeline: OrderTrackingEvent[];
}

@Injectable()
export class OrderTrackingService {
  constructor(
    @InjectRepository(SalesOrder)
    private readonly orderRepo: Repository<SalesOrder>,
    @InjectRepository(ApprovalRecord)
    private readonly approvalRepo: Repository<ApprovalRecord>,
    @InjectRepository(PaymentRecord)
    private readonly paymentRepo: Repository<PaymentRecord>,
    @InjectRepository(DeliveryOrder)
    private readonly deliveryRepo: Repository<DeliveryOrder>,
    @InjectRepository(ProductionOrder)
    private readonly productionRepo: Repository<ProductionOrder>,
    @InjectRepository(PurchaseRequest)
    private readonly purchaseRequestRepo: Repository<PurchaseRequest>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepo: Repository<PurchaseOrder>,
    @InjectRepository(InvoiceRecord)
    private readonly invoiceRepo: Repository<InvoiceRecord>,
    @InjectRepository(Voucher)
    private readonly voucherRepo: Repository<Voucher>,
  ) {}

  async getTracking(orderId: string): Promise<OrderTrackingResult> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['customer', 'salesperson', 'creator'],
    });
    if (!order) {
      return {
        orderId,
        orderNo: null,
        status: 'unknown',
        timeline: [],
      };
    }

    const [
      approvalRecords,
      paymentRecords,
      deliveryOrders,
      productionOrders,
      purchaseRequests,
      invoices,
      vouchers,
    ] = await Promise.all([
      this.approvalRepo.find({
        where: { salesOrderId: orderId },
        order: { createdAt: 'ASC' },
      }),
      this.paymentRepo.find({
        where: { salesOrderId: orderId },
        order: { receivedAt: 'ASC' },
      }),
      this.deliveryRepo.find({
        where: { salesOrderId: orderId },
        order: { createdAt: 'ASC' },
      }),
      this.productionRepo.find({
        where: { salesOrderId: orderId },
        order: { createdAt: 'ASC' },
      }),
      this.purchaseRequestRepo.find({
        where: { salesOrderId: orderId },
        order: { createdAt: 'ASC' },
        relations: ['items'],
      }),
      this.invoiceRepo.find({
        where: { salesOrderId: orderId },
        order: { createdAt: 'ASC' },
      }),
      this.voucherRepo.find({
        where: { sourceType: 'sales_order', sourceId: orderId },
        order: { createdAt: 'ASC' },
        relations: ['items'],
      }),
    ]);

    // 通过采购申请的 convertedPoId 查询关联采购单
    const poIds = purchaseRequests
      .map((pr) => pr.convertedPoId)
      .filter((id): id is string => !!id);
    const purchaseOrders =
      poIds.length > 0
        ? await this.purchaseOrderRepo.find({
            where: poIds.map((id) => ({ id })),
            order: { createdAt: 'ASC' },
            relations: ['items', 'supplier'],
          })
        : [];

    const salesApproval = approvalRecords.find((r) => r.type === 'sales_order');
    const collectionApproval = approvalRecords.find(
      (r) => r.type === 'collection',
    );

    const timeline: OrderTrackingEvent[] = [];

    // 1. 创建订单
    timeline.push({
      stage: 'sales_order',
      stageLabel: '创建订单',
      status: 'finish',
      date: order.createdAt?.toISOString() || null,
      description: `订单创建，金额 ¥${order.payAmount || 0}`,
      details: [],
    });

    // 2. 审批
    if (salesApproval) {
      if (salesApproval.status === 'approved') {
        timeline.push({
          stage: 'approval',
          stageLabel: '销售审批',
          status: 'finish',
          date: salesApproval.updatedAt?.toISOString() || null,
          description: '审批通过',
          details: [salesApproval],
        });
      } else if (salesApproval.status === 'rejected') {
        timeline.push({
          stage: 'approval',
          stageLabel: '销售审批',
          status: 'error',
          date: salesApproval.updatedAt?.toISOString() || null,
          description: '审批驳回',
          details: [salesApproval],
        });
      } else {
        timeline.push({
          stage: 'approval',
          stageLabel: '销售审批',
          status: 'process',
          date: salesApproval.createdAt?.toISOString() || null,
          description: '审批中',
          details: [salesApproval],
        });
      }
    } else if (order.status === 'draft') {
      timeline.push({
        stage: 'approval',
        stageLabel: '销售审批',
        status: 'wait',
        date: null,
        description: '待提交审批',
        details: [],
      });
    }

    // 3. 生产
    if (productionOrders.length > 0) {
      const allCompleted = productionOrders.every(
        (po) => po.status === 'completed',
      );
      const anyProcessing = productionOrders.some(
        (po) => po.status === 'processing',
      );
      timeline.push({
        stage: 'production',
        stageLabel: '生产加工',
        status: allCompleted
          ? 'finish'
          : anyProcessing
            ? 'process'
            : 'wait',
        date: productionOrders[0].createdAt?.toISOString() || null,
        description: `${productionOrders.length} 张加工单`,
        details: productionOrders,
      });
    }

    // 4. 采购
    if (purchaseRequests.length > 0 || purchaseOrders.length > 0) {
      const allPoReceived = purchaseOrders.every(
        (po) => po.status === 'received' || po.status === 'completed',
      );
      const anyPoPending = purchaseOrders.some(
        (po) => po.status === 'approved' || po.status === 'partial_received',
      );
      timeline.push({
        stage: 'purchase',
        stageLabel: '采购入库',
        status: allPoReceived
          ? 'finish'
          : anyPoPending
            ? 'process'
            : 'wait',
        date:
          purchaseOrders[0]?.createdAt?.toISOString() ||
          purchaseRequests[0]?.createdAt?.toISOString() ||
          null,
        description: `${purchaseRequests.length} 笔采购申请，${purchaseOrders.length} 笔采购单`,
        details: [...purchaseRequests, ...purchaseOrders],
      });
    }

    // 5. 发货
    if (deliveryOrders.length > 0) {
      timeline.push({
        stage: 'delivery',
        stageLabel: '发货',
        status: 'finish',
        date: deliveryOrders[0].shippedAt?.toISOString() || null,
        description: `${deliveryOrders.length} 笔发货单`,
        details: deliveryOrders,
      });
    } else if (
      order.status === 'synced_jst' ||
      order.status === 'shipped' ||
      order.status === 'completed'
    ) {
      timeline.push({
        stage: 'delivery',
        stageLabel: '发货',
        status: order.status === 'synced_jst' ? 'wait' : 'finish',
        date: null,
        description: order.status === 'synced_jst' ? '待发货' : '已发货',
        details: [],
      });
    }

    // 6. 开票
    if (invoices.length > 0) {
      const allIssued = invoices.every((i) => i.status === 'issued');
      timeline.push({
        stage: 'invoice',
        stageLabel: '开票',
        status: allIssued ? 'finish' : 'process',
        date: invoices[0].invoiceDate?.toISOString() || null,
        description: `${invoices.length} 张发票，合计 ¥${invoices.reduce((s, i) => s + Number(i.amount || 0), 0)}`,
        details: invoices,
      });
    }

    // 7. 回款
    if (paymentRecords.length > 0 || collectionApproval) {
      const totalPaid = paymentRecords.reduce(
        (s, p) => s + Number(p.amount || 0),
        0,
      );
      if (collectionApproval) {
        if (collectionApproval.status === 'approved') {
          timeline.push({
            stage: 'collection',
            stageLabel: '回款',
            status: 'finish',
            date: collectionApproval.updatedAt?.toISOString() || null,
            description: `回款审批通过，合计 ¥${totalPaid}`,
            details: [...paymentRecords, collectionApproval],
          });
        } else if (collectionApproval.status === 'rejected') {
          timeline.push({
            stage: 'collection',
            stageLabel: '回款',
            status: 'error',
            date: collectionApproval.updatedAt?.toISOString() || null,
            description: '回款审批驳回',
            details: [collectionApproval, ...paymentRecords],
          });
        } else {
          timeline.push({
            stage: 'collection',
            stageLabel: '回款',
            status: 'process',
            date: collectionApproval.createdAt?.toISOString() || null,
            description: '回款审批中',
            details: [collectionApproval],
          });
        }
      } else {
        timeline.push({
          stage: 'collection',
          stageLabel: '回款',
          status: 'finish',
          date: paymentRecords[0]?.receivedAt?.toISOString() || null,
          description: `已回款 ¥${totalPaid}`,
          details: paymentRecords,
        });
      }
    }

    // 8. 凭证
    if (vouchers.length > 0) {
      timeline.push({
        stage: 'voucher',
        stageLabel: '会计凭证',
        status: 'finish',
        date: vouchers[0].createdAt?.toISOString() || null,
        description: `${vouchers.length} 张凭证`,
        details: vouchers,
      });
    }

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      status: order.status,
      timeline,
    };
  }
}
