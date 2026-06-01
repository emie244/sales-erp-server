import { useEffect, useState, useMemo } from 'react';
import { Row, Col, Card, List, Badge, Button, Tag, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCartOutlined,
  FileTextOutlined,
  TeamOutlined,
  MoneyCollectOutlined,
  HistoryOutlined,
  ShoppingOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import { fetchDashboard } from '@/api/users';
import type { DashboardKpi, DashboardPendingItem } from '@/api/users';

const roleTitleMap: Record<string, string> = {
  admin: '管理驾驶舱',
  sales: '销售工作台',
  purchaser: '采购工作台',
  finance: '财务工作台',
};

const cardBodyStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [kpis, setKpis] = useState<DashboardKpi[]>([]);
  const [pendingItems, setPendingItems] = useState<DashboardPendingItem[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchDashboard();
      setRole(data.role || '');
      setKpis(data.kpis || []);
      setPendingItems(data.pendingItems || []);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleKpiClick = (link?: string) => {
    if (link) navigate(link);
  };

  const handlePendingClick = (link?: string) => {
    if (link) navigate(link);
  };

  const quickActions = useMemo(() => [
    { label: '新建销售订单', icon: <ShoppingCartOutlined />, link: '/sales-orders', roles: ['admin', 'sales'] },
    { label: '新建客户', icon: <TeamOutlined />, link: '/customers', roles: ['admin', 'sales'] },
    { label: '新建采购单', icon: <ShoppingOutlined />, link: '/purchase-orders', roles: ['admin', 'purchaser'] },
    { label: '新建采购申请', icon: <FileTextOutlined />, link: '/purchase-requests', roles: ['admin', 'purchaser'] },
    { label: '登记回款', icon: <MoneyCollectOutlined />, link: '/sales-orders', roles: ['admin', 'sales', 'finance'] },
    { label: '库存流水', icon: <HistoryOutlined />, link: '/stock-ledger', roles: ['admin', 'sales', 'purchaser', 'finance'] },
    { label: '发票管理', icon: <FileDoneOutlined />, link: '/invoices', roles: ['admin', 'finance'] },
    { label: '会计凭证', icon: <FileTextOutlined />, link: '/vouchers', roles: ['admin', 'finance'] },
  ].filter((a) => a.roles.includes(role)), [role]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Title */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          {roleTitleMap[role] || '工作台'}
        </h2>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} align="stretch">
        {kpis.map((kpi) => (
          <Col xs={24} sm={12} lg={6} key={kpi.key} style={{ display: 'flex' }}>
            <Card
              style={{
                width: '100%',
                cursor: kpi.link ? 'pointer' : 'default',
                borderLeft: `4px solid ${kpi.color || '#2563EB'}`,
              }}
              bodyStyle={cardBodyStyle}
              onClick={() => handleKpiClick(kpi.link)}
              hoverable={!!kpi.link}
            >
              <div style={{ fontSize: 12, color: '#6E6E6E', marginBottom: 4 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 600, color: kpi.color || '#111111' }}>
                {kpi.value}
              </div>
              {kpi.suffix && (
                <div style={{ fontSize: 12, color: '#A0A0A0', marginTop: 4 }}>
                  {kpi.suffix}
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {/* Two-column layout: Pending Items + Quick Actions */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
        {/* Left: Pending Items */}
        <Col xs={24} lg={16} style={{ display: 'flex' }}>
          <Card
            title="待处理事项"
            style={{ width: '100%' }}
            bodyStyle={{ padding: 0 }}
          >
            <List
              dataSource={pendingItems}
              renderItem={(item) => (
                <List.Item
                  style={{ cursor: item.link ? 'pointer' : 'default', padding: '12px 24px' }}
                  onClick={() => handlePendingClick(item.link)}
                >
                  <List.Item.Meta
                    title={
                      <span style={{ fontWeight: 500 }}>
                        {item.title}
                        {item.tag && (
                          <Tag
                            style={{ marginLeft: 8, fontSize: 12 }}
                            color={
                              item.tag === '待审批'
                                ? 'warning'
                                : item.tag === '待开票'
                                ? 'processing'
                                : 'default'
                            }
                          >
                            {item.tag}
                          </Tag>
                        )}
                      </span>
                    }
                    description={
                      <span style={{ color: '#6E6E6E', fontSize: 12 }}>
                        {item.description || item.status || ''}
                      </span>
                    }
                  />
                  {item.status === 'pending' && <Badge status="warning" />}
                </List.Item>
              )}
              locale={{ emptyText: '暂无待处理事项' }}
            />
          </Card>
        </Col>

        {/* Right: Quick Actions */}
        <Col xs={24} lg={8} style={{ display: 'flex' }}>
          <Card
            title="快捷操作"
            style={{ width: '100%' }}
            bodyStyle={{ padding: 16 }}
          >
            <Row gutter={[8, 8]}>
              {quickActions.map((action) => (
                <Col span={12} key={action.label}>
                  <Button
                    icon={action.icon}
                    style={{
                      width: '100%',
                      height: 48,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                    onClick={() => navigate(action.link)}
                  >
                    {action.label}
                  </Button>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
