import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Spin, Empty, Card, Descriptions, Table, Tag, Steps } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { fetchSalesOrderById } from '@/api/sales';
import PageHeader from '@/components/PageHeader';

const statusMap: Record<string, { label: string; color: string; step: number }> = {
  draft: { label: '草稿', color: 'default', step: 0 },
  pending_approval: { label: '待审批', color: 'processing', step: 1 },
  approved: { label: '已审批', color: 'success', step: 2 },
  synced_jst: { label: '已同步', color: 'blue', step: 3 },
  shipped: { label: '已发货', color: 'cyan', step: 4 },
  completed: { label: '已完成', color: 'green', step: 5 },
  cancelled: { label: '已取消', color: 'red', step: -1 },
  rejected: { label: '已驳回', color: 'orange', step: -1 },
};

export default function SalesOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchSalesOrderById(id)
      .then((data) => {
        setOrder(data);
        setErr(null);
      })
      .catch((e: any) => {
        setErr(e?.message || '加载失败');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (err) {
    return <Empty description={err} />;
  }

  if (!order) {
    return <Empty description="未找到订单信息" />;
  }

  const status = statusMap[order.status] || { label: order.status, color: 'default', step: 0 };
  const stepItems = [
    { title: '草稿' },
    { title: '待审批' },
    { title: '已审批' },
    { title: '已同步' },
    { title: '已发货' },
    { title: '已完成' },
  ];

  return (
    <div>
      <PageHeader
        title="订单详情"
        left={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
        }
      />
      <div style={{ padding: 16 }}>
        {status.step >= 0 && (
          <Card style={{ marginBottom: 16 }}>
            <Steps current={status.step} items={stepItems} />
          </Card>
        )}

        <Card title="基本信息" style={{ marginBottom: 16 }}>
          <Descriptions bordered column={2}>
            <Descriptions.Item label="订单编号">{order.orderNo || order.id}</Descriptions.Item>
            <Descriptions.Item label="订单状态">
              <Tag color={status.color}>{status.label}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="客户">{order.customer?.name || order.customerName || '-'}</Descriptions.Item>
            <Descriptions.Item label="销售员">{order.salesperson?.name || order.salespersonName || '-'}</Descriptions.Item>
            <Descriptions.Item label="订单金额">¥{Number(order.totalAmount || 0).toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="应付金额">¥{Number(order.payAmount || 0).toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="已收款">¥{Number(order.collectedAmount || 0).toFixed(2)}</Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {order.createdAt ? new Date(order.createdAt).toLocaleString('zh-CN') : '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="订单明细">
          <Table
            dataSource={order.items || []}
            rowKey="id"
            pagination={false}
            columns={[
              { title: 'SKU', dataIndex: 'skuName' },
              { title: 'SKU编码', dataIndex: 'skuCode' },
              { title: '数量', dataIndex: 'qty' },
              { title: '单价', dataIndex: 'unitPrice', render: (v: number) => `¥${Number(v || 0).toFixed(2)}` },
              { title: '行金额', dataIndex: 'lineAmount', render: (v: number) => `¥${Number(v || 0).toFixed(2)}` },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
