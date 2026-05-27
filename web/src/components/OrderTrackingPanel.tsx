import { useEffect, useState } from 'react';
import { Timeline, Card, Tag, Spin, Empty, Table } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  ToolOutlined,
  InboxOutlined,
  CarOutlined,
  CreditCardOutlined,
  DollarOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { fetchOrderTracking } from '@/api/sales';
import type { OrderTrackingResult, OrderTrackingEvent } from '@/api/sales';
import { formatDateTime } from '@/utils/datetime';

interface Props {
  orderId: string;
}

const stageIconMap: Record<string, React.ReactNode> = {
  sales_order: <ShoppingCartOutlined />,
  approval: <FileTextOutlined />,
  production: <ToolOutlined />,
  purchase: <InboxOutlined />,
  delivery: <CarOutlined />,
  invoice: <CreditCardOutlined />,
  collection: <DollarOutlined />,
  voucher: <BankOutlined />,
};

const statusColorMap: Record<string, string> = {
  finish: 'green',
  process: 'blue',
  wait: 'default',
  error: 'red',
};

const statusLabelMap: Record<string, string> = {
  finish: '已完成',
  process: '进行中',
  wait: '待处理',
  error: '异常',
};

export default function OrderTrackingPanel({ orderId }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OrderTrackingResult | null>(null);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    fetchOrderTracking(orderId)
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin />
      </div>
    );
  }

  if (!data || !data.timeline.length) {
    return <Empty description="暂无跟踪数据" />;
  }

  const renderDetailTable = (event: OrderTrackingEvent) => {
    if (!event.details?.length) return null;

    if (event.stage === 'production') {
      return (
        <Table
          size="small"
          bordered
          pagination={false}
          dataSource={event.details}
          rowKey="id"
          columns={[
            { title: '工单号', dataIndex: 'orderNo', key: 'orderNo' },
            { title: 'SKU', dataIndex: 'skuName', key: 'skuName' },
            { title: '数量', dataIndex: 'qty', key: 'qty', align: 'right' as const },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              render: (v: string) => {
                const map: Record<string, { label: string; color: string }> = {
                  pending: { label: '待处理', color: 'default' },
                  processing: { label: '加工中', color: 'processing' },
                  completed: { label: '已完成', color: 'success' },
                  cancelled: { label: '已取消', color: 'red' },
                };
                const s = map[v] || { label: v, color: 'default' };
                return <Tag color={s.color}>{s.label}</Tag>;
              },
            },
          ]}
        />
      );
    }

    if (event.stage === 'purchase') {
      const requests = event.details.filter((d: any) => d.prNo);
      const orders = event.details.filter((d: any) => d.orderNo);
      return (
        <div>
          {requests.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
                采购申请
              </div>
              <Table
                size="small"
                bordered
                pagination={false}
                dataSource={requests}
                rowKey="id"
                columns={[
                  { title: '申请号', dataIndex: 'prNo', key: 'prNo' },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    key: 'status',
                    render: (v: string) => {
                      const map: Record<string, string> = {
                        draft: '草稿',
                        pending_approval: '待审批',
                        approved: '已批准',
                        rejected: '已驳回',
                        converted: '已转单',
                        cancelled: '已取消',
                      };
                      return <Tag>{map[v] || v}</Tag>;
                    },
                  },
                  {
                    title: '明细',
                    key: 'items',
                    render: (_: any, r: any) =>
                      r.items
                        ?.map((i: any) => `${i.skuName} x${i.qty}`)
                        .join(', ') || '-',
                  },
                ]}
              />
            </div>
          )}
          {orders.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
                采购单
              </div>
              <Table
                size="small"
                bordered
                pagination={false}
                dataSource={orders}
                rowKey="id"
                columns={[
                  { title: '单号', dataIndex: 'orderNo', key: 'orderNo' },
                  {
                    title: '供应商',
                    dataIndex: 'supplierName',
                    key: 'supplierName',
                    render: (v: string) => v || '-',
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    key: 'status',
                    render: (v: string) => {
                      const map: Record<string, string> = {
                        draft: '草稿',
                        pending_approval: '待审批',
                        approved: '已批准',
                        partial_received: '部分收货',
                        received: '已收货',
                        completed: '已完成',
                      };
                      return <Tag>{map[v] || v}</Tag>;
                    },
                  },
                  {
                    title: '预计到货',
                    dataIndex: 'expectedDeliveryDate',
                    key: 'expectedDeliveryDate',
                    render: (v: string) =>
                      v ? new Date(v).toLocaleDateString('zh-CN') : '-',
                  },
                ]}
              />
            </div>
          )}
        </div>
      );
    }

    if (event.stage === 'delivery') {
      return (
        <Table
          size="small"
          bordered
          pagination={false}
          dataSource={event.details}
          rowKey="id"
          columns={[
            { title: '快递单号', dataIndex: 'trackingNo', key: 'trackingNo', render: (v: string) => v || '-' },
            { title: '承运商', dataIndex: 'carrier', key: 'carrier', render: (v: string) => v || '-' },
            { title: '发货时间', dataIndex: 'shippedAt', key: 'shippedAt', render: (v: string) => (v ? formatDateTime(v) : '-') },
          ]}
        />
      );
    }

    if (event.stage === 'invoice') {
      return (
        <Table
          size="small"
          bordered
          pagination={false}
          dataSource={event.details}
          rowKey="id"
          columns={[
            { title: '发票号码', dataIndex: 'invoiceNo', key: 'invoiceNo' },
            {
              title: '金额',
              dataIndex: 'amount',
              key: 'amount',
              align: 'right' as const,
              render: (v: number) => `¥${(v || 0).toFixed(2)}`,
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              render: (v: string) => {
                const map: Record<string, { label: string; color: string }> = {
                  draft: { label: '草稿', color: 'default' },
                  issued: { label: '已开具', color: 'green' },
                  cancelled: { label: '已作废', color: 'red' },
                };
                const s = map[v] || { label: v, color: 'default' };
                return <Tag color={s.color}>{s.label}</Tag>;
              },
            },
            {
              title: '开票日期',
              dataIndex: 'invoiceDate',
              key: 'invoiceDate',
              render: (v: string) => (v ? new Date(v).toLocaleDateString('zh-CN') : '-'),
            },
          ]}
        />
      );
    }

    if (event.stage === 'collection') {
      const payments = event.details.filter((d: any) => d.method || d.amount);
      const approvals = event.details.filter((d: any) => d.type === 'collection');
      return (
        <div>
          {approvals.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {approvals.map((a: any) => (
                <Tag
                  key={a.id}
                  color={
                    a.status === 'approved'
                      ? 'green'
                      : a.status === 'rejected'
                        ? 'red'
                        : 'blue'
                  }
                >
                  回款审批:{' '}
                  {a.status === 'approved'
                    ? '已通过'
                    : a.status === 'rejected'
                      ? '已驳回'
                      : '审批中'}
                </Tag>
              ))}
            </div>
          )}
          {payments.length > 0 && (
            <Table
              size="small"
              bordered
              pagination={false}
              dataSource={payments}
              rowKey="id"
              columns={[
                {
                  title: '回款时间',
                  dataIndex: 'receivedAt',
                  key: 'receivedAt',
                  render: (v: string) => (v ? formatDateTime(v) : '-'),
                },
                {
                  title: '方式',
                  dataIndex: 'method',
                  key: 'method',
                  render: (v: string) => v || '-',
                },
                {
                  title: '金额',
                  dataIndex: 'amount',
                  key: 'amount',
                  align: 'right' as const,
                  render: (v: number) => `¥${(v || 0).toFixed(2)}`,
                },
              ]}
            />
          )}
        </div>
      );
    }

    if (event.stage === 'voucher') {
      return (
        <Table
          size="small"
          bordered
          pagination={false}
          dataSource={event.details}
          rowKey="id"
          columns={[
            { title: '凭证号', dataIndex: 'voucherNo', key: 'voucherNo' },
            {
              title: '类型',
              dataIndex: 'type',
              key: 'type',
              render: (v: string) => {
                const map: Record<string, string> = {
                  receivable: '应收',
                  receipt: '收款',
                  payment: '付款',
                  adjustment: '调整',
                };
                return map[v] || v;
              },
            },
            {
              title: '金额',
              dataIndex: 'totalAmount',
              key: 'totalAmount',
              align: 'right' as const,
              render: (v: number) => `¥${(v || 0).toFixed(2)}`,
            },
            {
              title: '日期',
              dataIndex: 'voucherDate',
              key: 'voucherDate',
              render: (v: string) => (v ? new Date(v).toLocaleDateString('zh-CN') : '-'),
            },
          ]}
        />
      );
    }

    return null;
  };

  return (
    <div style={{ padding: '8px 0' }}>
      <Timeline mode="left">
        {data.timeline.map((event) => (
          <Timeline.Item
            key={event.stage}
            dot={
              event.status === 'finish' ? (
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
              ) : event.status === 'process' ? (
                <SyncOutlined style={{ color: '#1890ff', fontSize: 16 }} spin />
              ) : event.status === 'error' ? (
                <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
              ) : (
                <ClockCircleOutlined style={{ color: '#bfbfbf', fontSize: 16 }} />
              )
            }
            label={
              event.date ? (
                <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                  {formatDateTime(event.date)}
                </span>
              ) : (
                <span style={{ color: '#bfbfbf', fontSize: 12 }}>--</span>
              )
            }
          >
            <Card
              size="small"
              title={
                <span style={{ fontWeight: 600 }}>
                  {stageIconMap[event.stage]}{' '}
                  {event.stageLabel}
                  <Tag
                    color={statusColorMap[event.status]}
                    style={{ marginLeft: 8, fontSize: 12 }}
                  >
                    {statusLabelMap[event.status]}
                  </Tag>
                </span>
              }
              style={{
                background:
                  event.status === 'error'
                    ? '#fff2f0'
                    : event.status === 'process'
                      ? '#e6f7ff'
                      : '#fafafa',
                borderColor:
                  event.status === 'error'
                    ? '#ffccc7'
                    : event.status === 'process'
                      ? '#91d5ff'
                      : '#f0f0f0',
              }}
            >
              <div style={{ color: '#595959', marginBottom: 8 }}>
                {event.description}
              </div>
              {renderDetailTable(event)}
            </Card>
          </Timeline.Item>
        ))}
      </Timeline>
    </div>
  );
}
