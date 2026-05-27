import { useEffect, useState, useMemo } from 'react';
import {
  Row,
  Col,
  List,
  Badge,
  message,
  Card,
  DatePicker,
  Select,
  Button,
  Progress,
  Modal,
  Input,
  Table,
  Space,
  Popconfirm,
  Tag,
} from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { Column, Bar } from '@ant-design/charts';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  fetchTotalOrderAmount,
  fetchTotalCollectedAmount,
  fetchSalespersonRanking,
  fetchProductRanking,
  fetchTargetProgress,
  fetchTargets,
  createTarget,
  updateTarget,
  deleteTarget,
  fetchDashboardStats,
} from '@/api/reports';
import { fetchUsers } from '@/api/users';

const { RangePicker } = DatePicker;

const cardStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
};

const cardBodyStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
};

const clickableCardStyle: React.CSSProperties = {
  ...cardStyle,
  cursor: 'pointer',
};

const getPresetRange = (preset: string): [string, string] => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (preset === '本月') {
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    return [start, today];
  }
  if (preset === '上月') {
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    return [
      `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`,
      `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`,
    ];
  }
  if (preset === '近三月') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return [
      `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`,
      today,
    ];
  }
  return [today, today];
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const isAdmin = localStorage.getItem('erp_role') === 'admin';

  const [todayOrders, setTodayOrders] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [pendingShipment, setPendingShipment] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [itemTypeNullCount, setItemTypeNullCount] = useState(0);
  const [codeNonCompliantCount, setCodeNonCompliantCount] = useState(0);

  // Filtered metrics (affected by date range filters)
  const [totalOrderData, setTotalOrderData] = useState({
    orderCount: 0,
    totalAmount: 0,
    payAmount: 0,
    collectedAmount: 0,
  });
  const [collectedAmount, setCollectedAmount] = useState(0);
  const [salespersonRanking, setSalespersonRanking] = useState<any[]>([]);
  const [productRanking, setProductRanking] = useState<any[]>([]);
  const [targetProgress, setTargetProgress] = useState<any[]>([]);
  const [pendingList, setPendingList] = useState<any[]>([]);

  // Loading states per section
  const [initialLoading, setInitialLoading] = useState(true);
  const [orderLoading, setOrderLoading] = useState(false);
  const [collectLoading, setCollectLoading] = useState(false);

  // Filters (default to current month)
  const [orderDateRange, setOrderDateRange] = useState<[string, string] | null>(
    () => getPresetRange('本月'),
  );
  const [collectedDateRange, setCollectedDateRange] = useState<
    [string, string] | null
  >(() => getPresetRange('本月'));
  const [showOrderFilter, setShowOrderFilter] = useState(false);
  const [showCollectFilter, setShowCollectFilter] = useState(false);
  const [orderPreset, setOrderPreset] = useState<string | null>('本月');
  const [collectPreset, setCollectPreset] = useState<string | null>('本月');

  const [targetPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Target management modal
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [targets, setTargets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [editingTarget, setEditingTarget] = useState<any>(null);
  const [targetForm, setTargetForm] = useState({
    userId: '',
    targetAmount: '',
  });

  const loadStaticData = async () => {
    try {
      const stats = await fetchDashboardStats();
      setTodayOrders(stats.todayOrders);
      setPendingApprovals(stats.pendingApprovals);
      setPendingList(stats.pendingList || []);
      setPendingShipment(stats.pendingShipment);
      setLowStockCount(stats.lowStockCount);
      setUncategorizedCount(stats.uncategorizedCount || 0);
      setItemTypeNullCount(stats.itemTypeNullCount || 0);
      setCodeNonCompliantCount(stats.codeNonCompliantCount || 0);
    } catch {
      // silent fail for static metrics
    }
  };

  const loadOrderMetrics = async (withLoading = true) => {
    if (withLoading) setOrderLoading(true);
    try {
      const orderFilters: any = {};
      if (orderDateRange) {
        orderFilters.dateFrom = orderDateRange[0];
        orderFilters.dateTo = orderDateRange[1];
      }
      const orderData = await fetchTotalOrderAmount(orderFilters);
      setTotalOrderData(
        orderData && typeof orderData === 'object'
          ? orderData
          : { orderCount: 0, totalAmount: 0, payAmount: 0, collectedAmount: 0 },
      );
    } catch {
      message.error('加载订单数据失败');
    } finally {
      if (withLoading) setOrderLoading(false);
    }
  };

  const loadCollectMetrics = async (withLoading = true) => {
    if (withLoading) setCollectLoading(true);
    try {
      const collectFilters: any = {};
      if (collectedDateRange) {
        collectFilters.dateFrom = collectedDateRange[0];
        collectFilters.dateTo = collectedDateRange[1];
      }
      const collected = await fetchTotalCollectedAmount(collectFilters);
      setCollectedAmount(collected.total || 0);
    } catch {
      message.error('加载回款数据失败');
    } finally {
      if (withLoading) setCollectLoading(false);
    }
  };

  const loadRankings = async () => {
    try {
      const salespersons = await fetchSalespersonRanking({ limit: 10 });
      setSalespersonRanking(salespersons);
      const products = await fetchProductRanking({ limit: 10 });
      setProductRanking(products);
    } catch {
      // silent fail
    }
  };

  const loadTargets = async () => {
    try {
      const progress = await fetchTargetProgress(targetPeriod);
      setTargetProgress(progress);
    } catch {
      // silent fail
    }
  };

  useEffect(() => {
    const init = async () => {
      setInitialLoading(true);
      await Promise.all([
        loadStaticData(),
        loadOrderMetrics(false),
        loadCollectMetrics(false),
        loadRankings(),
        loadTargets(),
      ]);
      setInitialLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    loadOrderMetrics();
  }, [orderDateRange]);

  useEffect(() => {
    loadCollectMetrics();
  }, [collectedDateRange]);

  const loadTargetList = async () => {
    const res = await fetchTargets(targetPeriod);
    setTargets(res);
  };

  const loadUserList = async () => {
    const res = await fetchUsers();
    setUsers(Array.isArray(res) ? res : (res as any).data || []);
  };

  const handleOpenTargetModal = async () => {
    await Promise.all([loadTargetList(), loadUserList()]);
    setTargetModalOpen(true);
  };

  const handleSaveTarget = async () => {
    if (!targetForm.userId || !targetForm.targetAmount) {
      message.error('请选择人员并输入目标金额');
      return;
    }
    try {
      const user = users.find((u) => u.id === targetForm.userId);
      if (editingTarget) {
        await updateTarget(editingTarget.id, {
          targetAmount: Number(targetForm.targetAmount),
        });
      } else {
        await createTarget({
          userId: targetForm.userId,
          userName: user?.name,
          targetAmount: Number(targetForm.targetAmount),
          period: targetPeriod,
        });
      }
      message.success('保存成功');
      setEditingTarget(null);
      setTargetForm({ userId: '', targetAmount: '' });
      await loadTargetList();
      await loadTargets();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDeleteTarget = async (id: string) => {
    try {
      await deleteTarget(id);
      message.success('删除成功');
      await loadTargetList();
      await loadTargets();
    } catch {
      message.error('删除失败');
    }
  };

  // Drill-down handlers
  const goToOrders = (params?: Record<string, string>) => {
    const search = params ? new URLSearchParams(params).toString() : '';
    navigate(`/sales-orders${search ? '?' + search : ''}`);
  };

  const goToApprovals = () => navigate('/approvals');
  const goToStocks = () => navigate('/products?status=warning');
  const goToInventory = (governance?: string) => {
    if (governance) {
      navigate(`/products?governance=${governance}`);
    } else {
      navigate('/products');
    }
  };

  const salespersonChartData = useMemo(
    () =>
      salespersonRanking.map((s: any) => ({
        name: s.salespersonName || s.salespersonId?.slice(0, 6) || '未知',
        value: Number(s.totalAmount || 0),
      })),
    [salespersonRanking],
  );

  const productChartData = useMemo(
    () =>
      productRanking.map((p: any) => ({
        name: p.productName || p.productId?.slice(0, 6) || '未知',
        value: Number(p.totalAmount || 0),
      })),
    [productRanking],
  );

  const chartConfig = (data: any[]) => ({
    data,
    xField: 'name',
    yField: 'value',
    height: 220,
    autoFit: true,
    label: { position: 'middle' as const },
    interactions: [{ type: 'element-active' as const }],
  });

  const targetColumns = [
    {
      title: '人员',
      dataIndex: 'userName',
      key: 'userName',
      width: 100,
      ellipsis: true,
    },
    {
      title: '目标金额',
      dataIndex: 'targetAmount',
      key: 'targetAmount',
      width: 120,
      align: 'right' as const,
      render: (v: number) => `¥${Number(v || 0).toFixed(2)}`,
    },
    {
      title: '实际完成',
      dataIndex: 'actualAmount',
      key: 'actualAmount',
      width: 120,
      align: 'right' as const,
      render: (v: number) => `¥${Number(v || 0).toFixed(2)}`,
    },
    {
      title: '完成度',
      dataIndex: 'progress',
      key: 'progress',
      width: 160,
      render: (v: number) => (
        <Progress
          percent={Number((v || 0).toFixed(1))}
          status={v >= 100 ? 'success' : 'active'}
          format={() => `${(v || 0).toFixed(1)}%`}
        />
      ),
    },
  ];

  if (isAdmin) {
    targetColumns.push({
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            onClick={() => {
              setEditingTarget(record);
              setTargetForm({
                userId: record.userId,
                targetAmount: String(record.targetAmount),
              });
            }}
          >
            修改
          </Button>
          <Popconfirm
            title="确认删除？"
            onConfirm={() => handleDeleteTarget(record.id)}
          >
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    } as any);
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Row 1: Basic metrics */}
      <Row gutter={[16, 16]} align="stretch">
        <Col xs={24} sm={12} lg={12} xl={6} style={{ display: 'flex' }}>
          <Card
            title="今日订单"
            style={clickableCardStyle}
            bodyStyle={cardBodyStyle}
            loading={initialLoading}
            onClick={() =>
              goToOrders({
                dateFrom: new Date().toISOString().split('T')[0],
                dateTo: new Date().toISOString().split('T')[0],
              })
            }
          >
            <div style={{ fontSize: 28, fontWeight: 600, color: '#2563EB' }}>
              {todayOrders}
            </div>
            <div style={{ fontSize: 12, color: '#6E6E6E', marginTop: 4 }}>
              笔
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={12} xl={6} style={{ display: 'flex' }}>
          <Card
            title="待审批"
            style={clickableCardStyle}
            bodyStyle={cardBodyStyle}
            loading={initialLoading}
            onClick={goToApprovals}
          >
            <div style={{ fontSize: 28, fontWeight: 600, color: '#F59E0B' }}>
              {pendingApprovals}
            </div>
            <div style={{ fontSize: 12, color: '#6E6E6E', marginTop: 4 }}>
              条待处理
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={12} xl={6} style={{ display: 'flex' }}>
          <Card
            title="待发货"
            style={clickableCardStyle}
            bodyStyle={cardBodyStyle}
            loading={initialLoading}
            onClick={() => goToOrders({ status: 'approved' })}
          >
            <div style={{ fontSize: 28, fontWeight: 600, color: '#7C3AED' }}>
              {pendingShipment}
            </div>
            <div style={{ fontSize: 12, color: '#6E6E6E', marginTop: 4 }}>
              条订单待推送到聚水潭
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={12} xl={6} style={{ display: 'flex' }}>
          <Card
            title="库存预警"
            style={clickableCardStyle}
            bodyStyle={cardBodyStyle}
            loading={initialLoading}
            onClick={goToStocks}
          >
            <div style={{ fontSize: 28, fontWeight: 600, color: '#EF4444' }}>
              {lowStockCount}
            </div>
            <div style={{ fontSize: 12, color: '#6E6E6E', marginTop: 4 }}>
              个 SKU 库存低于安全线
            </div>
          </Card>
        </Col>
      </Row>

      {/* Row 1.5: Governance KPIs (admin only) */}
      {isAdmin && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
          <Col xs={24} sm={12} lg={8} style={{ display: 'flex' }}>
            <Card
              title="待分类物料"
              style={clickableCardStyle}
              bodyStyle={cardBodyStyle}
              loading={initialLoading}
              onClick={() => goToInventory('uncategorized')}
            >
              <div style={{ fontSize: 28, fontWeight: 600, color: '#FA8C16' }}>
                {uncategorizedCount}
              </div>
              <div style={{ fontSize: 12, color: '#6E6E6E', marginTop: 4 }}>
                个 SKU 未分配物料分类
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8} style={{ display: 'flex' }}>
            <Card
              title="未归类大类"
              style={clickableCardStyle}
              bodyStyle={cardBodyStyle}
              loading={initialLoading}
              onClick={() => goToInventory('item_type_null')}
            >
              <div style={{ fontSize: 28, fontWeight: 600, color: '#722ED1' }}>
                {itemTypeNullCount}
              </div>
              <div style={{ fontSize: 12, color: '#6E6E6E', marginTop: 4 }}>
                个 SKU 缺少 item_type
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8} style={{ display: 'flex' }}>
            <Card
              title="不合规编码"
              style={clickableCardStyle}
              bodyStyle={cardBodyStyle}
              loading={initialLoading}
              onClick={() => goToInventory('non_compliant')}
            >
              <div style={{ fontSize: 28, fontWeight: 600, color: '#EF4444' }}>
                {codeNonCompliantCount}
              </div>
              <div style={{ fontSize: 12, color: '#6E6E6E', marginTop: 4 }}>
                个 SKU 编码不符合规范
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Row 2: Filterable metrics */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
        <Col xs={24} sm={12} lg={12} xl={8} style={{ display: 'flex' }}>
          <Card
            title="订单总金额"
            style={cardStyle}
            bodyStyle={{ ...cardBodyStyle, justifyContent: 'flex-start' }}
            loading={orderLoading}
            extra={
              <Space size={4}>
                {orderDateRange && (
                  <Tag
                    closable
                    onClose={() => {
                      setOrderDateRange(null);
                      setOrderPreset(null);
                    }}
                  >
                    {orderDateRange[0]} ~ {orderDateRange[1]}
                  </Tag>
                )}
                <Button
                  type={showOrderFilter ? 'primary' : 'text'}
                  size="small"
                  icon={<FilterOutlined />}
                  onClick={() => setShowOrderFilter(!showOrderFilter)}
                />
              </Space>
            }
          >
            {showOrderFilter && (
              <div style={{ marginBottom: 12 }}>
                <Space
                  size={4}
                  style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap' }}
                >
                  {['本月', '上月', '近三月'].map((preset) => (
                    <Button
                      key={preset}
                      type={orderPreset === preset ? 'primary' : 'default'}
                      size="small"
                      onClick={() => {
                        if (orderPreset === preset) {
                          setOrderPreset(null);
                          setOrderDateRange(null);
                        } else {
                          setOrderPreset(preset);
                          setOrderDateRange(getPresetRange(preset));
                        }
                      }}
                    >
                      {preset}
                    </Button>
                  ))}
                </Space>
                <RangePicker
                  size="small"
                  value={
                    orderDateRange
                      ? [dayjs(orderDateRange[0]), dayjs(orderDateRange[1])]
                      : null
                  }
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      setOrderDateRange([
                        dates[0].format('YYYY-MM-DD'),
                        dates[1].format('YYYY-MM-DD'),
                      ]);
                    } else {
                      setOrderDateRange(null);
                      setOrderPreset(null);
                    }
                  }}
                />
              </div>
            )}
            <div style={{ fontSize: 24, fontWeight: 600, color: '#2563EB' }}>
              ¥{Number(totalOrderData?.totalAmount || 0).toFixed(2)}
            </div>
            <div style={{ fontSize: 12, color: '#6E6E6E', marginTop: 4 }}>
              {totalOrderData?.orderCount ?? 0} 笔订单
            </div>
            <div style={{ fontSize: 12, color: '#6E6E6E' }}>
              应收: ¥{Number(totalOrderData?.payAmount || 0).toFixed(2)}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={12} xl={8} style={{ display: 'flex' }}>
          <Card
            title="已回款金额"
            style={cardStyle}
            bodyStyle={{ ...cardBodyStyle, justifyContent: 'flex-start' }}
            loading={collectLoading}
            extra={
              <Space size={4}>
                {collectedDateRange && (
                  <Tag
                    closable
                    onClose={() => {
                      setCollectedDateRange(null);
                      setCollectPreset(null);
                    }}
                  >
                    {collectedDateRange[0]} ~ {collectedDateRange[1]}
                  </Tag>
                )}
                <Button
                  type={showCollectFilter ? 'primary' : 'text'}
                  size="small"
                  icon={<FilterOutlined />}
                  onClick={() => setShowCollectFilter(!showCollectFilter)}
                />
              </Space>
            }
          >
            {showCollectFilter && (
              <div style={{ marginBottom: 12 }}>
                <Space
                  size={4}
                  style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap' }}
                >
                  {['本月', '上月', '近三月'].map((preset) => (
                    <Button
                      key={preset}
                      type={collectPreset === preset ? 'primary' : 'default'}
                      size="small"
                      onClick={() => {
                        if (collectPreset === preset) {
                          setCollectPreset(null);
                          setCollectedDateRange(null);
                        } else {
                          setCollectPreset(preset);
                          setCollectedDateRange(getPresetRange(preset));
                        }
                      }}
                    >
                      {preset}
                    </Button>
                  ))}
                </Space>
                <RangePicker
                  size="small"
                  value={
                    collectedDateRange
                      ? [dayjs(collectedDateRange[0]), dayjs(collectedDateRange[1])]
                      : null
                  }
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      setCollectedDateRange([
                        dates[0].format('YYYY-MM-DD'),
                        dates[1].format('YYYY-MM-DD'),
                      ]);
                    } else {
                      setCollectedDateRange(null);
                      setCollectPreset(null);
                    }
                  }}
                />
              </div>
            )}
            <div style={{ fontSize: 24, fontWeight: 600, color: '#10B981' }}>
              ¥{Number(collectedAmount || 0).toFixed(2)}
            </div>
            <div style={{ fontSize: 12, color: '#6E6E6E', marginTop: 4 }}>
              回款率:{' '}
              {(totalOrderData?.payAmount || 0) > 0
                ? ((collectedAmount / (totalOrderData?.payAmount || 1)) * 100).toFixed(
                    1,
                  )
                : 0}
              %
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={12} xl={8} style={{ display: 'flex' }}>
          <Card
            title="业绩目标"
            style={cardStyle}
            bodyStyle={{ ...cardBodyStyle, justifyContent: 'flex-start' }}
            loading={initialLoading}
            extra={
              isAdmin && (
                <Button
                  type="primary"
                  size="small"
                  onClick={handleOpenTargetModal}
                >
                  设置目标
                </Button>
              )
            }
          >
            {(() => {
              const totalTarget = targetProgress.reduce(
                (sum, t) => sum + Number(t.targetAmount || 0),
                0,
              );
              const totalActual = targetProgress.reduce(
                (sum, t) => sum + Number(t.actualAmount || 0),
                0,
              );
              const overallProgress =
                totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
              return (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 600,
                          color: '#7C3AED',
                        }}
                      >
                        ¥{totalTarget.toFixed(0)}
                      </div>
                      <div
                        style={{ fontSize: 12, color: '#6E6E6E', marginTop: 4 }}
                      >
                        总目标 / 周期 {targetPeriod}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 500,
                          color: '#10B981',
                        }}
                      >
                        ¥{totalActual.toFixed(0)}
                      </div>
                      <div style={{ fontSize: 12, color: '#6E6E6E' }}>
                        已完成
                      </div>
                    </div>
                  </div>
                  <Progress
                    percent={Number(overallProgress.toFixed(1))}
                    size="small"
                    status={overallProgress >= 100 ? 'success' : 'active'}
                    style={{ marginTop: 8 }}
                  />
                  <div style={{ fontSize: 12, color: '#6E6E6E', marginTop: 4 }}>
                    {targetProgress.length} 人参与
                  </div>
                </>
              );
            })()}
          </Card>
        </Col>
      </Row>

      {/* Row 3: Rankings */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="业务员排行（Top 10）" loading={initialLoading}>
            {salespersonRanking.length === 0 ? (
              <div
                style={{ color: '#6E6E6E', textAlign: 'center', padding: 20 }}
              >
                暂无数据
              </div>
            ) : (
              <Column
                {...chartConfig(salespersonChartData)}
                onEvent={(chart: any) => {
                  chart.on('element:click', (evt: any) => {
                    const name = evt?.data?.data?.name;
                    if (!name) return;
                    const salesperson = salespersonRanking.find(
                      (s) =>
                        (s.salespersonName ||
                          s.salespersonId?.slice(0, 6) ||
                          '未知') === name,
                    );
                    if (salesperson?.salespersonId) {
                      goToOrders({ salespersonId: salesperson.salespersonId });
                    }
                  });
                }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="产品销售额排行（Top 10）" loading={initialLoading}>
            {productRanking.length === 0 ? (
              <div
                style={{ color: '#6E6E6E', textAlign: 'center', padding: 20 }}
              >
                暂无数据
              </div>
            ) : (
              <Bar
                {...chartConfig(productChartData)}
                onEvent={(chart: any) => {
                  chart.on('element:click', (evt: any) => {
                    const name = evt?.data?.data?.name;
                    if (!name) return;
                    // 后端暂不支持 productId 筛选，改用产品名称作为关键字搜索
                    goToOrders({ keyword: name });
                  });
                }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Row 4: Target progress table */}
      <Row style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card
            title="人员目标进度"
            loading={initialLoading}
            extra={
              isAdmin && (
                <Button
                  type="primary"
                  size="small"
                  onClick={handleOpenTargetModal}
                >
                  管理目标
                </Button>
              )
            }
          >
            <Table
              rowKey="userId"
              columns={targetColumns}
              dataSource={targetProgress}
              pagination={false}
              size="small"
              scroll={{ x: 620 }}
              style={{ width: '100%' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Row 5: Pending approvals */}
      <Row style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card
            title="待处理审批"
            style={clickableCardStyle}
            onClick={goToApprovals}
          >
            <List
              dataSource={pendingList}
              renderItem={(item) => (
                <List.Item>
                  <Badge status="warning" text={`审批 ${item.instanceCode}`} />
                </List.Item>
              )}
              locale={{ emptyText: '暂无待审批' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Target management modal */}
      <Modal
        title={editingTarget ? '修改目标' : '设置业绩目标'}
        open={targetModalOpen}
        onOk={handleSaveTarget}
        onCancel={() => {
          setTargetModalOpen(false);
          setEditingTarget(null);
          setTargetForm({ userId: '', targetAmount: '' });
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <div style={{ marginBottom: 4 }}>周期</div>
            <Input value={targetPeriod} disabled />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>人员</div>
            <Select
              style={{ width: '100%' }}
              value={targetForm.userId || undefined}
              disabled={!!editingTarget}
              placeholder="选择人员"
              onChange={(v) => setTargetForm({ ...targetForm, userId: v })}
              options={users.map((u) => ({
                label: u.name || u.id,
                value: u.id,
              }))}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>目标金额</div>
            <Input
              type="number"
              value={targetForm.targetAmount}
              placeholder="输入目标金额"
              onChange={(e) =>
                setTargetForm({ ...targetForm, targetAmount: e.target.value })
              }
            />
          </div>
        </Space>

        <div style={{ marginTop: 24 }}>
          <div style={{ fontWeight: 500, marginBottom: 12 }}>当前目标列表</div>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            style={{ width: '100%' }}
            columns={[
              { title: '人员', dataIndex: 'userName', key: 'userName' },
              {
                title: '目标',
                dataIndex: 'targetAmount',
                key: 'targetAmount',
                render: (v: number) => `¥${Number(v || 0).toFixed(2)}`,
              },
              {
                title: '操作',
                key: 'action',
                render: (_: any, record: any) => (
                  <Space>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setEditingTarget(record);
                        setTargetForm({
                          userId: record.userId,
                          targetAmount: String(record.targetAmount),
                        });
                      }}
                    >
                      修改
                    </Button>
                    <Popconfirm
                      title="确认删除？"
                      onConfirm={() => handleDeleteTarget(record.id)}
                    >
                      <Button type="link" danger size="small">
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
            dataSource={targets}
          />
        </div>
      </Modal>
    </div>
  );
}
