import { useEffect, useState } from 'react';
import { Table, Card, Statistic, Row, Col, Tag, message } from 'antd';
import { fetchAgingReport, fetchOverdueOrders } from '@/api/sales';
import PageHeader from '@/components/PageHeader';
import type { AgingReportItem } from '@/api/sales';
import type { SalesOrder } from '@/types';

export default function AgingReportPage() {
  const [agingData, setAgingData] = useState<AgingReportItem[]>([]);
  const [overdueData, setOverdueData] = useState<SalesOrder[]>([]);
  const [overdueTotal, setOverdueTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [aging, overdue] = await Promise.all([
        fetchAgingReport(),
        fetchOverdueOrders({ page: 1, pageSize: 50 }),
      ]);
      setAgingData(aging);
      setOverdueData(overdue.data);
      setOverdueTotal(overdue.total);
    } catch {
      message.error('加载账龄报表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalCurrent = agingData.reduce((s, r) => s + r.current, 0);
  const total1to30 = agingData.reduce((s, r) => s + r.days1to30, 0);
  const total31to60 = agingData.reduce((s, r) => s + r.days31to60, 0);
  const total61to90 = agingData.reduce((s, r) => s + r.days61to90, 0);
  const total90plus = agingData.reduce((s, r) => s + r.days90plus, 0);
  const grandTotal = agingData.reduce((s, r) => s + r.total, 0);

  const agingColumns = [
    { title: '客户名称', dataIndex: 'customerName', key: 'customerName', width: 180, fixed: 'left' as const },
    {
      title: '当前',
      dataIndex: 'current',
      key: 'current',
      align: 'right' as const,
      render: (v: number) => `¥${v.toFixed(2)}`,
    },
    {
      title: '1-30天',
      dataIndex: 'days1to30',
      key: 'days1to30',
      align: 'right' as const,
      render: (v: number) => `¥${v.toFixed(2)}`,
    },
    {
      title: '31-60天',
      dataIndex: 'days31to60',
      key: 'days31to60',
      align: 'right' as const,
      render: (v: number) =>
        v > 0 ? (
          <span style={{ color: '#faad14' }}>¥{v.toFixed(2)}</span>
        ) : (
          '¥0.00'
        ),
    },
    {
      title: '61-90天',
      dataIndex: 'days61to90',
      key: 'days61to90',
      align: 'right' as const,
      render: (v: number) =>
        v > 0 ? (
          <span style={{ color: '#fa8c16' }}>¥{v.toFixed(2)}</span>
        ) : (
          '¥0.00'
        ),
    },
    {
      title: '90天以上',
      dataIndex: 'days90plus',
      key: 'days90plus',
      align: 'right' as const,
      render: (v: number) =>
        v > 0 ? (
          <span style={{ color: '#ff4d4f' }}>¥{v.toFixed(2)}</span>
        ) : (
          '¥0.00'
        ),
    },
    {
      title: '合计',
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      render: (v: number) => <strong>¥{v.toFixed(2)}</strong>,
    },
  ];

  const overdueColumns = [
    {
      title: '订单号',
      dataIndex: 'id',
      key: 'id',
      width: 180,
      ellipsis: true,
    },
    {
      title: '客户',
      key: 'customer',
      render: (_: any, record: any) => record.customer?.name || '-',
    },
    {
      title: '应付金额',
      dataIndex: 'payAmount',
      align: 'right' as const,
      render: (v: number) => `¥${(v || 0).toFixed(2)}`,
    },
    {
      title: '已回款',
      dataIndex: 'collectedAmount',
      align: 'right' as const,
      render: (v: number) => `¥${(v || 0).toFixed(2)}`,
    },
    {
      title: '未收金额',
      key: 'remaining',
      align: 'right' as const,
      render: (_: any, record: any) => {
        const remaining =
          (record.payAmount || 0) -
          (record.collectedAmount || 0) -
          (record.prepaymentDeducted || 0);
        return `¥${remaining.toFixed(2)}`;
      },
    },
    {
      title: '付款截止',
      dataIndex: 'paymentDueDate',
      render: (v: string) => {
        if (!v) return '-';
        const due = new Date(v);
        const now = new Date();
        const days = Math.floor(
          (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24),
        );
        return (
          <span>
            {due.toLocaleDateString('zh-CN')}
            {days > 0 && (
              <Tag color="red" style={{ marginLeft: 4 }}>
                逾期{days}天
              </Tag>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="账龄分析与逾期预警" />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="应收账款合计"
              value={grandTotal}
              precision={2}
              prefix="¥"
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="当前" value={totalCurrent} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="1-30天"
              value={total1to30}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="31-60天"
              value={total31to60}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="61-90天"
              value={total61to90}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#ff7875' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="90天以上"
              value={total90plus}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="客户账龄分布" style={{ marginBottom: 24, flexShrink: 0 }}>
        <Table
          rowKey="customerId"
          columns={agingColumns}
          dataSource={agingData}
          loading={loading}
          sticky
          pagination={false}
          size="small"
          bordered
          scroll={{ x: 900, y: 'calc(100vh - 360px)' }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <strong>合计</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  <strong>¥{totalCurrent.toFixed(2)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <strong>¥{total1to30.toFixed(2)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  <strong>¥{total31to60.toFixed(2)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <strong>¥{total61to90.toFixed(2)}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <strong style={{ color: '#ff4d4f' }}>
                    ¥{total90plus.toFixed(2)}
                  </strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <strong>¥{grandTotal.toFixed(2)}</strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      <Card title={`逾期订单（共 ${overdueTotal} 条）`} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Table
          rowKey="id"
          columns={overdueColumns}
          dataSource={overdueData}
          loading={loading}
          sticky
          pagination={false}
          size="small"
          bordered
          scroll={{ x: 900, y: 'calc(100vh - 360px)' }}
        />
      </Card>
    </div>
  );
}
