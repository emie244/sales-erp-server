import { useEffect, useState } from 'react';
import { Tabs, Table, message } from 'antd';
import { Column } from '@ant-design/charts';
import {
  fetchSalesSummary,
  fetchPaymentCollect,
  fetchRepAchievement,
} from '@/api/reports';

export default function ReportPage() {
  const [tab, setTab] = useState('sales');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async (activeTab: string) => {
    setLoading(true);
    try {
      let res: any[] = [];
      if (activeTab === 'sales') res = await fetchSalesSummary();
      else if (activeTab === 'payment') res = await fetchPaymentCollect();
      else if (activeTab === 'achievement') res = await fetchRepAchievement();
      setData(res);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(tab);
  }, [tab]);

  const tabItems = [
    { key: 'sales', label: '销售汇总' },
    { key: 'payment', label: '收款统计' },
    { key: 'achievement', label: '业绩排行' },
  ];

  const salesColumns = [
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: '订单数', dataIndex: 'orderCount', key: 'orderCount' },
    {
      title: '销售额',
      dataIndex: 'totalPayAmount',
      key: 'totalPayAmount',
      render: (v: string) => `¥${parseFloat(v || '0').toFixed(2)}`,
    },
  ];

  const paymentColumns = [
    { title: '支付方式', dataIndex: 'method', key: 'method' },
    {
      title: '总金额',
      dataIndex: 'total',
      key: 'total',
      render: (v: string) => `¥${parseFloat(v || '0').toFixed(2)}`,
    },
  ];

  const achievementColumns = [
    { title: '业务员ID', dataIndex: 'userId', key: 'userId' },
    {
      title: '总业绩',
      dataIndex: 'total',
      key: 'total',
      render: (v: string) => `¥${parseFloat(v || '0').toFixed(2)}`,
    },
  ];

  const chartData =
    tab === 'sales'
      ? data.map((d) => ({
          name: d.date?.split('T')[0] || d.date,
          value: parseFloat(d.totalPayAmount) || 0,
        }))
      : tab === 'payment'
        ? data.map((d) => ({
            name: d.method || '未知',
            value: parseFloat(d.total) || 0,
          }))
        : data.map((d) => ({
            name: d.userId || '未知',
            value: parseFloat(d.total) || 0,
          }));

  const chartConfig = {
    data: chartData,
    xField: 'name',
    yField: 'value',
    height: 260,
    autoFit: true,
    label: { position: 'middle' as const },
  };

  const columns =
    tab === 'sales'
      ? salesColumns
      : tab === 'payment'
        ? paymentColumns
        : achievementColumns;

  return (
    <div style={{ width: '100%' }}>
      <Tabs
        activeKey={tab}
        onChange={(k) => {
          setTab(k);
          loadData(k);
        }}
        items={tabItems}
      />
      <div
        style={{
          background: '#FFFFFF',
          padding: 16,
          borderRadius: 12,
          marginBottom: 16,
        }}
      >
        <Column {...chartConfig} />
      </div>
      <Table
        rowKey={(r) => r.date || r.method || r.userId || Math.random()}
        columns={columns}
        dataSource={data}
        loading={loading}
      />
    </div>
  );
}
