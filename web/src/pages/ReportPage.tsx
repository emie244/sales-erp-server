import { useEffect, useState, useMemo } from 'react';
import {
  Tabs, Table, message, Card, DatePicker, Button, Space, Row, Col, Statistic,
} from 'antd';
import { Column, Bar } from '@ant-design/charts';
import { DownloadOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import {
  fetchSalesSummary,
  fetchPaymentCollect,
  fetchPaymentRecords,
  fetchRepAchievement,
  fetchTotalOrderAmount,
  fetchTotalCollectedAmount,
  fetchSignerRanking,
  fetchProductRanking,
  fetchTargetProgress,
} from '@/api/reports';

const { RangePicker } = DatePicker;

function exportExcel(filename: string, columns: { title: string; dataIndex: string }[], data: any[]) {
  const rows = data.map((row) =>
    columns.reduce((acc, col) => {
      acc[col.title] = row[col.dataIndex];
      return acc;
    }, {} as Record<string, any>),
  );
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
}

function formatMoney(v: number | string) {
  return `¥${parseFloat(String(v || 0)).toFixed(2)}`;
}

export default function ReportPage() {
  const [tab, setTab] = useState('overview');
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [loading, setLoading] = useState(false);

  // Data states
  const [salesData, setSalesData] = useState<any[]>([]);
  const [paymentData, setPaymentData] = useState<{ collect: any[]; records: any[] }>({ collect: [], records: [] });
  const [achievementData, setAchievementData] = useState<any[]>([]);
  const [signerData, setSignerData] = useState<any[]>([]);
  const [productData, setProductData] = useState<any[]>([]);
  const [targetData, setTargetData] = useState<any[]>([]);
  const [overviewData, setOverviewData] = useState({ orderCount: 0, totalAmount: 0, payAmount: 0, collectedAmount: 0 });
  const [totalCollected, setTotalCollected] = useState(0);

  const dateParams = useMemo(() => {
    if (!dateRange) return {};
    return { dateFrom: dateRange[0], dateTo: dateRange[1] };
  }, [dateRange]);

  const loadOverview = async () => {
    try {
      const [orderRes, collectRes] = await Promise.all([
        fetchTotalOrderAmount(dateParams),
        fetchTotalCollectedAmount(dateParams),
      ]);
      setOverviewData(orderRes);
      setTotalCollected(collectRes.total || 0);
    } catch {
      // silent
    }
  };

  const loadSales = async () => {
    try {
      const res = await fetchSalesSummary(dateParams);
      setSalesData(res);
    } catch {
      message.error('加载销售汇总失败');
    }
  };

  const loadPayment = async () => {
    try {
      const [collectRes, recordsRes] = await Promise.all([
        fetchPaymentCollect(dateParams),
        fetchPaymentRecords(dateParams),
      ]);
      setPaymentData({ collect: collectRes, records: recordsRes });
    } catch {
      message.error('加载收款统计失败');
    }
  };

  const loadAchievement = async () => {
    try {
      const res = await fetchRepAchievement();
      setAchievementData(res);
    } catch {
      message.error('加载业绩排行失败');
    }
  };

  const loadSignerRanking = async () => {
    try {
      const res = await fetchSignerRanking({ ...dateParams, limit: 50 });
      setSignerData(res);
    } catch {
      message.error('加载签单人排行失败');
    }
  };

  const loadProductRanking = async () => {
    try {
      const res = await fetchProductRanking({ ...dateParams, limit: 50 });
      setProductData(res);
    } catch {
      message.error('加载产品排行失败');
    }
  };

  const loadTargetProgress = async () => {
    try {
      const res = await fetchTargetProgress();
      setTargetData(res);
    } catch {
      message.error('加载目标进度失败');
    }
  };

  const loadAll = async (activeTab: string) => {
    setLoading(true);
    await loadOverview();
    if (activeTab === 'overview') await loadSales();
    if (activeTab === 'payment') await loadPayment();
    if (activeTab === 'achievement') await loadAchievement();
    if (activeTab === 'signer') await loadSignerRanking();
    if (activeTab === 'product') await loadProductRanking();
    if (activeTab === 'target') await loadTargetProgress();
    setLoading(false);
  };

  useEffect(() => {
    loadAll(tab);
  }, [tab, dateRange]);

  const handleExport = () => {
    if (tab === 'overview') {
      exportExcel('销售汇总.xlsx', [
        { title: '日期', dataIndex: 'date' },
        { title: '签单人', dataIndex: 'signerName' },
        { title: '订单数', dataIndex: 'orderCount' },
        { title: '销售额', dataIndex: 'totalPayAmount' },
        { title: '提成金额', dataIndex: 'totalCommissionAmount' },
      ], salesData);
    } else if (tab === 'payment') {
      exportExcel('收款明细.csv', [
        { title: '收款时间', dataIndex: 'receivedAt' },
        { title: '支付方式', dataIndex: 'method' },
        { title: '金额', dataIndex: 'amount' },
        { title: '签单人', dataIndex: 'signerName' },
        { title: '订单号', dataIndex: 'salesOrderId' },
      ], paymentData.records);
    } else if (tab === 'achievement') {
      exportExcel('业绩排行.csv', [
        { title: '用户ID', dataIndex: 'userId' },
        { title: '总业绩', dataIndex: 'total' },
      ], achievementData);
    } else if (tab === 'signer') {
      exportExcel('签单人排行.csv', [
        { title: '签单人', dataIndex: 'signerName' },
        { title: '订单数', dataIndex: 'orderCount' },
        { title: '总金额', dataIndex: 'totalAmount' },
      ], signerData);
    } else if (tab === 'product') {
      exportExcel('产品排行.csv', [
        { title: '产品名称', dataIndex: 'productName' },
        { title: '销量', dataIndex: 'totalQty' },
        { title: '销售金额', dataIndex: 'totalAmount' },
      ], productData);
    } else if (tab === 'target') {
      exportExcel('目标进度.csv', [
        { title: '用户', dataIndex: 'userName' },
        { title: '目标金额', dataIndex: 'targetAmount' },
        { title: '实际金额', dataIndex: 'actualAmount' },
        { title: '完成率%', dataIndex: 'progress' },
      ], targetData);
    }
    message.success('导出成功');
  };

  const tabItems = [
    { key: 'overview', label: '销售总览' },
    { key: 'payment', label: '收款统计' },
    { key: 'signer', label: '签单人排行' },
    { key: 'product', label: '产品排行' },
    { key: 'achievement', label: '业绩排行' },
    { key: 'target', label: '目标进度' },
  ];

  // Overview cards
  const overviewCards = (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic title="订单数" value={overviewData.orderCount} />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic title="订单总金额" value={formatMoney(overviewData.totalAmount)} />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic title="实付金额" value={formatMoney(overviewData.payAmount)} />
        </Card>
      </Col>
      <Col xs={24} sm={12} md={6}>
        <Card>
          <Statistic title="已收款" value={formatMoney(totalCollected)} />
        </Card>
      </Col>
    </Row>
  );

  // Overview tab content
  const overviewContent = (
    <>
      {overviewCards}
      <Card title="销售趋势" style={{ marginBottom: 16 }}>
        <Column
          data={salesData.reduce((acc: any[], d: any) => {
            const date = d.date?.split('T')[0] || d.date;
            const existing = acc.find((item: any) => item.date === date);
            const amount = parseFloat(d.totalPayAmount) || 0;
            if (existing) {
              existing.销售额 += amount;
            } else {
              acc.push({ date, 销售额: amount });
            }
            return acc;
          }, [])}
          xField="date"
          yField="销售额"
          height={280}
          autoFit
          label={{ position: 'middle' }}
          xAxis={{
            label: {
              autoRotate: true,
              autoHide: true,
            },
          }}
        />
      </Card>
      <Table
        rowKey={(r, i) => `${r.date}-${r.signerId}-${i}`}
        columns={[
          { title: '日期', dataIndex: 'date', render: (v: string) => v?.split('T')[0] || v },
          { title: '签单人', dataIndex: 'signerName', render: (v: string, r: any) => v || r.signerId || '-' },
          { title: '订单数', dataIndex: 'orderCount' },
          { title: '销售额', dataIndex: 'totalPayAmount', render: formatMoney },
          { title: '提成金额', dataIndex: 'totalCommissionAmount', render: formatMoney },
        ]}
        dataSource={salesData}
        loading={loading}
        scroll={{ x: 'max-content' }}
        style={{ width: '100%' }}
      />
    </>
  );

  // Payment tab content
  const paymentContent = (
    <>
      {overviewCards}
      <Card title="收款方式分布" style={{ marginBottom: 16 }}>
        <Bar
          data={paymentData.collect.map((d: any) => ({
            method: d.method || '未知',
            amount: parseFloat(d.total) || 0,
          }))}
          xField="amount"
          yField="method"
          height={280}
          autoFit
          label={{ position: 'middle' }}
          yAxis={{
            label: {
              autoHide: true,
            },
          }}
        />
      </Card>
      <Table
        rowKey={(r) => r.id}
        columns={[
          { title: '收款时间', dataIndex: 'receivedAt', render: (v: string) => v?.split('T')[0] || v },
          { title: '支付方式', dataIndex: 'method' },
          { title: '金额', dataIndex: 'amount', render: formatMoney },
          { title: '签单人', dataIndex: 'signerName', render: (v: string) => v || '-' },
          { title: '订单号', dataIndex: 'salesOrderId', render: (v: string) => v || '-' },
        ]}
        dataSource={paymentData.records}
        loading={loading}
        scroll={{ x: 'max-content' }}
        style={{ width: '100%' }}
      />
    </>
  );

  // Signer ranking content
  const signerContent = (
    <>
      <Card title="签单人排行" style={{ marginBottom: 16 }}>
        <Column
          data={signerData.map((d) => ({
            name: d.signerName || d.signerId,
            amount: parseFloat(d.totalAmount) || 0,
          }))}
          xField="name"
          yField="amount"
          height={320}
          autoFit
          label={{ position: 'middle' }}
          style={{ radius: [4, 4, 0, 0] }}
          xAxis={{
            label: {
              autoRotate: true,
              autoHide: true,
            },
          }}
        />
      </Card>
      <Table
        rowKey={(r) => r.signerId}
        columns={[
          { title: '排名', render: (_: any, __: any, idx: number) => idx + 1, width: 60 },
          { title: '签单人', dataIndex: 'signerName', render: (v: string, r: any) => v || r.signerId },
          { title: '订单数', dataIndex: 'orderCount' },
          { title: '总金额', dataIndex: 'totalAmount', render: formatMoney },
        ]}
        dataSource={signerData}
        loading={loading}
        scroll={{ x: 'max-content' }}
        style={{ width: '100%' }}
      />
    </>
  );

  // Product ranking content
  const productContent = (
    <>
      <Card title="产品销售额排行" style={{ marginBottom: 16 }}>
        <Column
          data={productData.map((d) => ({
            name: d.productName || d.productId,
            amount: parseFloat(d.totalAmount) || 0,
          }))}
          xField="name"
          yField="amount"
          height={320}
          autoFit
          label={{ position: 'middle' }}
          style={{ radius: [4, 4, 0, 0] }}
          xAxis={{
            label: {
              autoRotate: true,
              autoHide: true,
            },
          }}
        />
      </Card>
      <Table
        rowKey={(r) => r.productId}
        columns={[
          { title: '排名', render: (_: any, __: any, idx: number) => idx + 1, width: 60 },
          { title: '产品名称', dataIndex: 'productName', render: (v: string, r: any) => v || r.productId },
          { title: '销量', dataIndex: 'totalQty' },
          { title: '销售金额', dataIndex: 'totalAmount', render: formatMoney },
        ]}
        dataSource={productData}
        loading={loading}
        scroll={{ x: 'max-content' }}
        style={{ width: '100%' }}
      />
    </>
  );

  // Achievement content
  const achievementContent = (
    <>
      <Card title="业绩排行" style={{ marginBottom: 16 }}>
        <Column
          data={achievementData.map((d) => ({
            name: d.userName || d.userId,
            amount: parseFloat(d.total) || 0,
          }))}
          xField="name"
          yField="amount"
          height={280}
          autoFit
          label={{ position: 'middle' }}
        />
      </Card>
      <Table
        rowKey={(r) => r.userId}
        columns={[
          { title: '用户', dataIndex: 'userName', render: (v: string, r: any) => v || r.userId },
          { title: '总业绩', dataIndex: 'total', render: formatMoney },
        ]}
        dataSource={achievementData}
        loading={loading}
        scroll={{ x: 'max-content' }}
        style={{ width: '100%' }}
      />
    </>
  );

  // Target progress content
  const targetContent = (
    <Table
      rowKey={(r) => r.userId}
      columns={[
        { title: '用户', dataIndex: 'userName', render: (v: string, r: any) => v || r.userId },
        { title: '目标金额', dataIndex: 'targetAmount', render: formatMoney },
        { title: '实际金额', dataIndex: 'actualAmount', render: formatMoney },
        {
          title: '完成率',
          dataIndex: 'progress',
          render: (v: number) => `${(v || 0).toFixed(1)}%`,
        },
        {
          title: '进度',
          dataIndex: 'progress',
          render: (v: number) => (
            <div style={{ width: 120 }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>{(v || 0).toFixed(1)}%</div>
              <div style={{ background: '#f0f0f0', borderRadius: 4, height: 8 }}>
                <div
                  style={{
                    width: `${Math.min(v || 0, 100)}%`,
                    background: v >= 100 ? '#52c41a' : v >= 50 ? '#faad14' : '#ff4d4f',
                    borderRadius: 4,
                    height: 8,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>
          ),
        },
      ]}
      dataSource={targetData}
      loading={loading}
      scroll={{ x: 'max-content' }}
      style={{ width: '100%' }}
    />
  );

  const tabContentMap: Record<string, React.ReactNode> = {
    overview: overviewContent,
    payment: paymentContent,
    signer: signerContent,
    product: productContent,
    achievement: achievementContent,
    target: targetContent,
  };

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space>
            <RangePicker
              value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
              onChange={(vals) => {
                if (vals && vals[0] && vals[1]) {
                  setDateRange([
                    vals[0].format('YYYY-MM-DD'),
                    vals[1].format('YYYY-MM-DD'),
                  ]);
                } else {
                  setDateRange(null);
                }
              }}
            />
            <Button
              icon={<FilterOutlined />}
              onClick={() => {
                setDateRange(null);
                loadAll(tab);
              }}
            >
              重置筛选
            </Button>
          </Space>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
            导出 Excel
          </Button>
        </Space>

        <Tabs
          activeKey={tab}
          onChange={(k) => {
            setTab(k);
            loadAll(k);
          }}
          items={tabItems}
        />

        {tabContentMap[tab]}
      </Space>
    </div>
  );
}
