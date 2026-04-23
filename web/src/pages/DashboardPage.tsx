import { useEffect, useState } from 'react';
import { Row, Col, List, Badge, message } from 'antd';
import { Column } from '@ant-design/charts';
import StatCard from '@/components/StatCard';
import { fetchSalesSummary } from '@/api/reports';
import { fetchApprovals } from '@/api/approvals';
import { fetchSalesOrders } from '@/api/sales';

export default function DashboardPage() {
  const [todayOrders, setTodayOrders] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [monthlySales, setMonthlySales] = useState(0);
  const [monthlyPayments] = useState(0);
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [pendingList, setPendingList] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const ordersRes = await fetchSalesOrders({ page: 1, pageSize: 1000 });
      const approvals = await fetchApprovals();
      const summary = await fetchSalesSummary();
      const orders = ordersRes.data || [];

      setTodayOrders(
        orders.filter((o: any) => o.createdAt && o.createdAt.startsWith(today))
          .length,
      );
      setPendingApprovals(
        approvals.filter(
          (a: any) => a.status === 'pending' || a.feishuStatus === 'PENDING',
        ).length,
      );
      setMonthlySales(
        orders
          .filter((o: any) =>
            ['approved', 'synced_jst', 'shipped', 'completed'].includes(
              o.status,
            ),
          )
          .reduce(
            (sum: number, o: any) => sum + parseFloat(o.payAmount || 0),
            0,
          ),
      );
      setSalesTrend(summary.slice(0, 7));
      setPendingList(
        approvals
          .filter(
            (a: any) => a.status === 'pending' || a.feishuStatus === 'PENDING',
          )
          .slice(0, 5),
      );
    } catch (e) {
      message.error('加载仪表盘数据失败');
    }
  };

  const chartConfig = {
    data: salesTrend.map((s: any) => ({
      date: s.date?.split('T')[0] || s.date,
      销售额: parseFloat(s.totalPayAmount) || 0,
    })),
    xField: 'date',
    yField: '销售额',
    height: 220,
    autoFit: true,
  };

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <StatCard title="今日订单" value={todayOrders} />
        </Col>
        <Col span={6}>
          <StatCard
            title="待审批"
            value={pendingApprovals}
            valueStyle={{ color: '#fa8c16' }}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="本月销售额"
            value={monthlySales}
            prefix="¥"
            valueStyle={{ color: '#1890ff' }}
          />
        </Col>
        <Col span={6}>
          <StatCard
            title="本月收款"
            value={monthlyPayments}
            prefix="¥"
            valueStyle={{ color: '#52c41a' }}
          />
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={16}>
          <div style={{ background: '#fff', padding: 16, borderRadius: 8 }}>
            <div style={{ fontWeight: 500, marginBottom: 12 }}>
              销售趋势（近7天）
            </div>
            <Column {...chartConfig} />
          </div>
        </Col>
        <Col span={8}>
          <div
            style={{
              background: '#fff',
              padding: 16,
              borderRadius: 8,
              height: '100%',
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: 12 }}>待处理审批</div>
            <List
              dataSource={pendingList}
              renderItem={(item) => (
                <List.Item>
                  <Badge status="warning" text={`审批 ${item.instanceCode}`} />
                </List.Item>
              )}
              locale={{ emptyText: '暂无待审批' }}
            />
          </div>
        </Col>
      </Row>
    </div>
  );
}
