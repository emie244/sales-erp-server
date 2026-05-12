import { Modal, Descriptions, Table, Spin, Empty, Tag } from 'antd';
import type { PurchaseOrder, PurchaseOrderStatusLog } from '@/api/purchase-orders';
import { formatDateTime } from '@/utils/datetime';

interface Props {
  open: boolean;
  order: PurchaseOrder | null;
  loading: boolean;
  statusLogs: PurchaseOrderStatusLog[];
  onClose: () => void;
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  pending_approval: { text: '审批中', color: 'processing' },
  approved: { text: '已审批', color: 'success' },
  partial_received: { text: '部分到货', color: 'warning' },
  received: { text: '已全部到货', color: 'success' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'error' },
};

export default function PurchaseOrderDetailModal({
  open,
  order,
  loading,
  statusLogs,
  onClose,
}: Props) {
  const itemColumns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'SKU 编码',
      dataIndex: 'skuCode',
      key: 'skuCode',
      render: (v: string) => v || '-',
    },
    {
      title: 'SKU 名称',
      dataIndex: 'skuName',
      key: 'skuName',
      render: (v: string) => v || '-',
    },
    {
      title: '数量',
      dataIndex: 'qty',
      key: 'qty',
      align: 'right' as const,
    },
    {
      title: '已到货',
      dataIndex: 'receivedQty',
      key: 'receivedQty',
      align: 'right' as const,
      render: (v: number) => v || 0,
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      align: 'right' as const,
      render: (v: number) =>
        `¥${parseFloat(v?.toString() || '0').toFixed(2)}`,
    },
    {
      title: '小计',
      dataIndex: 'lineAmount',
      key: 'lineAmount',
      align: 'right' as const,
      render: (v: number) =>
        `¥${parseFloat(v?.toString() || '0').toFixed(2)}`,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (v: string) => v || '-',
    },
  ];

  const logColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '变更',
      key: 'change',
      width: 200,
      render: (_: any, record: PurchaseOrderStatusLog) => {
        const from = record.fromStatus
          ? STATUS_MAP[record.fromStatus]?.text || record.fromStatus
          : '-';
        const to = STATUS_MAP[record.toStatus]?.text || record.toStatus;
        return `${from} → ${to}`;
      },
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (v: string | null) => v || '-',
    },
  ];

  return (
    <Modal
      title="采购单详情"
      open={open}
      onCancel={onClose}
      footer={null}
      width={960}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      ) : !order ? (
        <Empty description="未找到采购单信息" />
      ) : (
        <div style={{ marginTop: 16 }}>
          <Descriptions title="基本信息" bordered size="small" column={2}>
            <Descriptions.Item label="采购单号">
              {order.orderNo}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_MAP[order.status]?.color || 'default'}>
                {STATUS_MAP[order.status]?.text || order.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="供应商">
              {order.supplierName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="总金额">
              ¥{parseFloat(order.totalAmount?.toString() || '0').toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {formatDateTime(order.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="审批实例">
              {order.approvalInstanceCode || '-'}
            </Descriptions.Item>
            {order.remark && (
              <Descriptions.Item label="备注" span={2}>
                {order.remark}
              </Descriptions.Item>
            )}
          </Descriptions>

          <div style={{ marginTop: 24 }}>
            <h4 style={{ marginBottom: 12, fontWeight: 600 }}>采购明细</h4>
            <Table
              rowKey="id"
              columns={itemColumns}
              dataSource={order.items || []}
              pagination={false}
              size="small"
              bordered
            />
          </div>

          {statusLogs.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h4 style={{ marginBottom: 12, fontWeight: 600 }}>状态变更记录</h4>
              <Table
                rowKey="id"
                columns={logColumns}
                dataSource={statusLogs}
                pagination={false}
                size="small"
                bordered
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
