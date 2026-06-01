import { useEffect, useState } from 'react';
import {
  Card,
  Avatar,
  Descriptions,
  Button,
  Form,
  Input,
  message,
  Row,
  Col,
  Statistic,
  Space,
  Divider,
  Badge,
  Tag,
  Progress,
} from 'antd';
import {
  UserOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  FileTextOutlined,
  FileDoneOutlined,
  WarningOutlined,
  StockOutlined,
  MoneyCollectOutlined,
  EditOutlined,
  LockOutlined,
  CheckCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import { fetchMe, updateMe, fetchDashboard } from '@/api/users';
import { getFeishuBindUrl, unbindFeishu } from '@/api/auth';
import { fetchDashboardStats, fetchTargetProgress } from '@/api/reports';
import type { UserProfile, DashboardStats } from '@/api/users';
import { getOperationLogs, type OperationLog } from '@/api/operation-logs';
import { fetchApprovals } from '@/api/approvals';
import { fetchDeliveryWarnings } from '@/api/sales';
import { fetchPurchaseRequests } from '@/api/purchase-requests';
import { fetchPurchaseOrders } from '@/api/purchase-orders';
import { fetchProductionOrders } from '@/api/production-orders';
import type { ApprovalRecord } from '@/types';
import type { SalesOrder } from '@/types';
import { formatDateTime } from '@/utils/datetime';

export default function ProfilePage() {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [pwdMode, setPwdMode] = useState(false);
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRecord[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [warnings, setWarnings] = useState<SalesOrder[]>([]);
  const [warningsLoading, setWarningsLoading] = useState(false);
  const [approvedList, setApprovedList] = useState<ApprovalRecord[]>([]);
  const [approvedLoading, setApprovedLoading] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [targetProgress, setTargetProgress] = useState<any[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [productionOrders, setProductionOrders] = useState<any[]>([]);

  const isAdmin = (user?.role || localStorage.getItem('erp_role')) === 'admin';

  // 处理飞书绑定回调
  useEffect(() => {
    const bindStatus = searchParams.get('bind');
    const error = searchParams.get('error');
    if (bindStatus === 'success') {
      message.success('飞书账号绑定成功');
      // 清除 URL 参数
      window.history.replaceState({}, '', window.location.pathname);
      loadData();
    } else if (error) {
      message.error(decodeURIComponent(error));
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([fetchMe(), fetchDashboard()]);
      setUser(u);
      setStats(s);
      form.setFieldsValue({
        name: u.name,
        email: u.email,
        phone: u.phone,
      });
      // 首次登录强制修改密码
      if (u.isFirstLogin || localStorage.getItem('erp_first_login')) {
        setPwdMode(true);
        message.warning('首次登录，请先修改默认密码');
      }
      // 加载最近操作记录
      loadLogs(u.name);
      // 加载待审批列表
      loadPendingApprovals();
      // 加载交期预警
      loadWarnings();
      // 加载已审批列表
      loadApproved();
      // 加载看板数据
      loadDashboardData();
      loadTargetData();
      // 加载采购看板数据
      loadPurchaseData();
      loadProductionData();
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (userName: string) => {
    setLogsLoading(true);
    try {
      const res = await getOperationLogs(1, 20, { userName });
      setLogs(res.data);
    } catch {
      // 静默失败，操作记录非核心功能
    } finally {
      setLogsLoading(false);
    }
  };

  const loadPendingApprovals = async () => {
    setPendingLoading(true);
    try {
      const res = await fetchApprovals({ status: 'pending' });
      setPendingApprovals(res || []);
    } catch {
      // 静默失败
    } finally {
      setPendingLoading(false);
    }
  };

  const loadWarnings = async () => {
    setWarningsLoading(true);
    try {
      const res = await fetchDeliveryWarnings({ page: 1, pageSize: 5 });
      setWarnings(res.data || []);
    } catch {
      // 静默失败
    } finally {
      setWarningsLoading(false);
    }
  };

  const loadApproved = async () => {
    setApprovedLoading(true);
    try {
      const res = await fetchApprovals({ status: 'approved' });
      setApprovedList(res || []);
    } catch {
      // 静默失败
    } finally {
      setApprovedLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      const res = await fetchDashboardStats();
      setDashboardStats(res);
    } catch {
      // 静默失败
    }
  };

  const loadTargetData = async () => {
    try {
      const res = await fetchTargetProgress();
      setTargetProgress(res || []);
    } catch {
      // 静默失败
    }
  };

  const loadPurchaseData = async () => {
    try {
      const [prRes, poRes] = await Promise.all([
        fetchPurchaseRequests({ status: 'approved', page: 1, pageSize: 5 }),
        fetchPurchaseOrders({ status: 'approved', page: 1, pageSize: 5 }),
      ]);
      setPurchaseRequests(prRes.data || []);
      setPurchaseOrders(poRes.data || []);
    } catch {
      // 静默失败
    }
  };

  const loadProductionData = async () => {
    try {
      const res = await fetchProductionOrders({ status: 'pending', page: 1, pageSize: 5 });
      setProductionOrders(res.data || []);
    } catch {
      // 静默失败
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdate = async (values: any) => {
    try {
      await updateMe(values);
      message.success('保存成功');
      setEditMode(false);
      loadData();
    } catch (err: any) {
      message.error(err?.message || '保存失败');
    }
  };

  const handleChangePassword = async (values: any) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }
    try {
      await updateMe({ password: values.newPassword, isFirstLogin: false });
      localStorage.removeItem('erp_first_login');
      message.success('密码修改成功');
      setPwdMode(false);
      pwdForm.resetFields();
    } catch (err: any) {
      message.error(err?.message || '修改失败');
    }
  };

  const roleMap: Record<string, string> = {
    admin: '管理员',
    sales: '销售',
    purchaser: '采购',
    finance: '财务',
    user: '普通用户',
  };

  const kpiIconMap: Record<string, React.ReactNode> = {
    todayOrders: <ShoppingCartOutlined style={{ fontSize: 24, color: '#1677ff' }} />,
    pendingApprovals: <FileTextOutlined style={{ fontSize: 24, color: '#faad14' }} />,
    pendingShipment: <ShoppingOutlined style={{ fontSize: 24, color: '#722ed1' }} />,
    lowStock: <StockOutlined style={{ fontSize: 24, color: '#eb2f96' }} />,
    monthOrders: <ShoppingCartOutlined style={{ fontSize: 24, color: '#1677ff' }} />,
    pendingOrders: <FileTextOutlined style={{ fontSize: 24, color: '#faad14' }} />,
    deliveryWarning: <WarningOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />,
    prepayment: <MoneyCollectOutlined style={{ fontSize: 24, color: '#10b981' }} />,
    monthPurchase: <ShoppingOutlined style={{ fontSize: 24, color: '#1677ff' }} />,
    pendingPO: <FileTextOutlined style={{ fontSize: 24, color: '#faad14' }} />,
    pendingPR: <FileTextOutlined style={{ fontSize: 24, color: '#722ed1' }} />,
    monthCollection: <MoneyCollectOutlined style={{ fontSize: 24, color: '#10b981' }} />,
    pendingInvoice: <FileDoneOutlined style={{ fontSize: 24, color: '#faad14' }} />,
    draftVouchers: <FileTextOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />,
    monthInvoice: <FileDoneOutlined style={{ fontSize: 24, color: '#1677ff' }} />,
  };

  const statCards = (stats?.kpis || []).map((kpi) => ({
    title: kpi.label,
    value: kpi.value,
    suffix: kpi.suffix || '',
    icon: kpiIconMap[kpi.key] || <ShoppingCartOutlined style={{ fontSize: 24, color: '#1677ff' }} />,
  }));

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="个人中心" />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card loading={loading} title="个人信息">
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Avatar
                size={80}
                src={user?.avatar}
                icon={!user?.avatar && <UserOutlined />}
              />
              <h3 style={{ marginTop: 12, marginBottom: 4 }}>{user?.name}</h3>
              <Badge
                status={user?.role === 'admin' ? 'processing' : 'default'}
                text={roleMap[user?.role || 'user'] || user?.role}
              />
            </div>

            {!editMode && !pwdMode && (
              <>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="邮箱">{user?.email}</Descriptions.Item>
                  <Descriptions.Item label="手机">{user?.phone || '-'}</Descriptions.Item>
                  <Descriptions.Item label="飞书绑定">
                    {user?.feishuUserId ? (
                      <Space>
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        <span>已绑定</span>
                        <Button
                          type="link"
                          size="small"
                          danger
                          onClick={async () => {
                            try {
                              await unbindFeishu();
                              message.success('解绑成功');
                              loadData();
                            } catch {
                              message.error('解绑失败');
                            }
                          }}
                        >
                          解绑
                        </Button>
                      </Space>
                    ) : (
                      <Space>
                        <WarningOutlined style={{ color: '#ff4d4f' }} />
                        <span style={{ color: '#ff4d4f' }}>未绑定</span>
                        <Button
                          type="link"
                          size="small"
                          onClick={async () => {
                            try {
                              const res = await getFeishuBindUrl();
                              window.location.href = res.url;
                            } catch {
                              message.error('获取绑定链接失败');
                            }
                          }}
                        >
                          去绑定
                        </Button>
                      </Space>
                    )}
                    {!user?.feishuUserId && (
                      <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 4 }}>
                        未绑定飞书将无法提交审批
                      </div>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="聚水潭店铺">
                    {user?.jushuitanShopId || (
                      <span style={{ color: '#999' }}>未配置</span>
                    )}
                  </Descriptions.Item>
                </Descriptions>
                <Divider />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                    我的权限
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(user?.permissions || []).length === 0 ? (
                      <span style={{ color: '#999', fontSize: 12 }}>暂无权限</span>
                    ) : (
                      (user?.permissions || []).map((perm) => (
                        <Tag key={perm} color="blue" style={{ fontSize: 12 }}>
                          {perm}
                        </Tag>
                      ))
                    )}
                  </div>
                </div>
                <Divider />
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    icon={<EditOutlined />}
                    block
                    onClick={() => setEditMode(true)}
                  >
                    编辑资料
                  </Button>
                  <Button
                    icon={<LockOutlined />}
                    block
                    onClick={() => setPwdMode(true)}
                  >
                    修改密码
                  </Button>
                </Space>
              </>
            )}

            {editMode && (
              <Form form={form} layout="vertical" onFinish={handleUpdate}>
                <Form.Item
                  name="name"
                  label="昵称"
                  rules={[{ required: true, message: '请输入昵称' }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  name="email"
                  label="邮箱"
                  rules={[
                    { required: true, message: '请输入邮箱' },
                    { type: 'email', message: '邮箱格式不正确' },
                  ]}
                >
                  <Input />
                </Form.Item>
                <Form.Item name="phone" label="手机号">
                  <Input />
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit">
                      保存
                    </Button>
                    <Button onClick={() => setEditMode(false)}>取消</Button>
                  </Space>
                </Form.Item>
              </Form>
            )}

            {pwdMode && (
              <Form
                form={pwdForm}
                layout="vertical"
                onFinish={handleChangePassword}
              >
                <Form.Item
                  name="newPassword"
                  label="新密码"
                  rules={[
                    { required: true, message: '请输入新密码' },
                    { min: 6, message: '密码至少6位' },
                  ]}
                >
                  <Input.Password />
                </Form.Item>
                <Form.Item
                  name="confirmPassword"
                  label="确认密码"
                  rules={[{ required: true, message: '请再次输入密码' }]}
                >
                  <Input.Password />
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit">
                      确认修改
                    </Button>
                    <Button onClick={() => { setPwdMode(false); pwdForm.resetFields(); }}>
                      取消
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {statCards.map((card) => (
              <Col xs={24} sm={12} key={card.title} style={{ display: 'flex' }}>
                <Card loading={loading} style={{ width: '100%', height: 100 }} bodyStyle={{ padding: '16px 20px', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
                    <Space align="center" size="large">
                      {card.icon}
                      <div>
                        <div style={{ color: '#666', fontSize: 14 }}>
                          {card.title}
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <Statistic
                            value={card.value}
                            suffix={card.suffix}
                            valueStyle={{ fontSize: 20, fontWeight: 600 }}
                          />
                        </div>
                      </div>
                    </Space>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          {pendingApprovals.length > 0 && (
            <Card
              title={
                <Space>
                  <span>我的待审批</span>
                  <Tag color="red">{pendingApprovals.length}</Tag>
                </Space>
              }
              loading={pendingLoading}
              style={{ marginBottom: 16 }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pendingApprovals.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14 }}>
                        <Tag color="orange">待审批</Tag>
                        <span style={{ marginLeft: 8 }}>
                          {item.type === 'sales_order' ? '销售订单' :
                           item.type === 'purchase_order' ? '采购单' :
                           item.type === 'purchase_request' ? '采购申请' :
                           item.type === 'collection' ? '回款' : item.type}
                        </span>
                        <span style={{ color: '#666', marginLeft: 8, fontSize: 12 }}>
                          {item.salesOrderId}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => (window.location.href = '/approvals')}
                    >
                      去处理
                    </Button>
                  </div>
                ))}
                {pendingApprovals.length > 5 && (
                  <div style={{ textAlign: 'center', paddingTop: 8 }}>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => (window.location.href = '/approvals')}
                    >
                      查看全部 {pendingApprovals.length} 条
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {warnings.length > 0 && (
            <Card
              title={
                <Space>
                  <span>交期预警</span>
                  <Tag color="orange">{warnings.length}</Tag>
                </Space>
              }
              loading={warningsLoading}
              style={{ marginBottom: 16 }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {warnings.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14 }}>
                        <Tag color="red">预警</Tag>
                        <span style={{ marginLeft: 8 }}>
                          {order.customer?.name || '-'}
                        </span>
                        <span style={{ color: '#666', marginLeft: 8, fontSize: 12 }}>
                          ¥{(order.payAmount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                        订单号: {order.id} | 交期: {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('zh-CN') : '-'}
                      </div>
                    </div>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => (window.location.href = `/sales-orders`)}
                    >
                      查看
                    </Button>
                  </div>
                ))}
                {warnings.length > 5 && (
                  <div style={{ textAlign: 'center', paddingTop: 8 }}>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => (window.location.href = '/sales-orders')}
                    >
                      查看全部 {warnings.length} 条
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {approvedList.length > 0 && (
            <Card
              title={
                <Space>
                  <span>我的已审批</span>
                  <Tag color="green">{approvedList.length}</Tag>
                </Space>
              }
              loading={approvedLoading}
              style={{ marginBottom: 16 }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {approvedList.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14 }}>
                        <Tag color="green">已批准</Tag>
                        <span style={{ marginLeft: 8 }}>
                          {item.type === 'sales_order' ? '销售订单' :
                           item.type === 'purchase_order' ? '采购单' :
                           item.type === 'purchase_request' ? '采购申请' :
                           item.type === 'collection' ? '回款' : item.type}
                        </span>
                        <span style={{ color: '#666', marginLeft: 8, fontSize: 12 }}>
                          {item.salesOrderId}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => (window.location.href = '/approvals')}
                    >
                      查看
                    </Button>
                  </div>
                ))}
                {approvedList.length > 5 && (
                  <div style={{ textAlign: 'center', paddingTop: 8 }}>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => (window.location.href = '/approvals')}
                    >
                      查看全部 {approvedList.length} 条
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card title="快捷入口" loading={loading}>
            <Space wrap size="middle">
              <Button
                icon={<LinkOutlined />}
                onClick={() => (window.location.href = '/sales-orders')}
              >
                销售订单
              </Button>
              <Button
                icon={<LinkOutlined />}
                onClick={() => (window.location.href = '/purchase-orders')}
              >
                采购单管理
              </Button>
              <Button
                icon={<LinkOutlined />}
                onClick={() => (window.location.href = '/approvals')}
              >
                审批中心
              </Button>
              <Button
                icon={<LinkOutlined />}
                onClick={() => (window.location.href = '/invoices')}
              >
                发票管理
              </Button>
              <Button
                icon={<LinkOutlined />}
                onClick={() => (window.location.href = '/production-orders')}
              >
                加工入库
              </Button>
              <Button
                icon={<LinkOutlined />}
                onClick={() => (window.location.href = '/stock-ledger')}
              >
                库存流水
              </Button>
            </Space>
          </Card>

          {/* 采购看板区域 */}
          {(purchaseRequests.length > 0 || purchaseOrders.length > 0 || productionOrders.length > 0) && (
            <Card
              title="采购/加工看板"
              style={{ marginTop: 16, marginBottom: 16 }}
            >
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="待处理采购申请"
                      value={purchaseRequests.length}
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="在途采购单"
                      value={purchaseOrders.length}
                      valueStyle={{ color: '#1677ff' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="待完成加工单"
                      value={productionOrders.length}
                      valueStyle={{ color: '#eb2f96' }}
                    />
                  </Card>
                </Col>
              </Row>

              {purchaseRequests.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                    待转采购单的申请
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {purchaseRequests.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 0',
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        <div style={{ fontSize: 13 }}>
                          <Tag color="warning">待转单</Tag>
                          <span style={{ marginLeft: 8 }}>{item.prNo}</span>
                          <span style={{ color: '#666', marginLeft: 8, fontSize: 12 }}>
                            ¥{(item.totalAmount || 0).toFixed(2)}
                          </span>
                        </div>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => (window.location.href = '/purchase-requests')}
                        >
                          查看
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {purchaseOrders.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                    在途采购单
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {purchaseOrders.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 0',
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        <div style={{ fontSize: 13 }}>
                          <Tag color="processing">在途</Tag>
                          <span style={{ marginLeft: 8 }}>{item.orderNo}</span>
                          <span style={{ color: '#666', marginLeft: 8, fontSize: 12 }}>
                            {item.supplierName}
                          </span>
                        </div>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => (window.location.href = '/purchase-orders')}
                        >
                          查看
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {productionOrders.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                    待完成加工单
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {productionOrders.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 0',
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        <div style={{ fontSize: 13 }}>
                          <Tag color="default">待完成</Tag>
                          <span style={{ marginLeft: 8 }}>{item.orderNo}</span>
                          <span style={{ color: '#666', marginLeft: 8, fontSize: 12 }}>
                            {item.skuName} x{item.qty}
                          </span>
                        </div>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => (window.location.href = '/production-orders')}
                        >
                          查看
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Admin 看板区域 */}
          {isAdmin && dashboardStats && (
            <Card
              title="系统运营看板"
              style={{ marginTop: 16, marginBottom: 16 }}
            >
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="今日订单"
                      value={dashboardStats.todayOrders || 0}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="待发货"
                      value={dashboardStats.pendingShipment || 0}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="待审批"
                      value={dashboardStats.pendingApprovals || 0}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card size="small">
                    <Statistic
                      title="低库存 SKU"
                      value={dashboardStats.lowStockCount || 0}
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Card>
                </Col>
              </Row>
              {dashboardStats.pendingList && dashboardStats.pendingList.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                    今日优先处理
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {dashboardStats.pendingList.slice(0, 5).map((item: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 0',
                          borderBottom: '1px solid #f0f0f0',
                        }}
                      >
                        <div style={{ fontSize: 13 }}>
                          <Tag color="warning">待处理</Tag>
                          <span style={{ marginLeft: 8 }}>{item.title || '-'}</span>
                        </div>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => {
                            if (item.link) window.location.href = item.link;
                          }}
                        >
                          查看
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* 业务员看板区域 */}
          {!isAdmin && targetProgress.length > 0 && (
            <Card
              title="本月目标进度"
              style={{ marginTop: 16, marginBottom: 16 }}
            >
              <Row gutter={[16, 16]}>
                {targetProgress.map((item: any) => (
                  <Col span={12} key={item.userId}>
                    <Card size="small">
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontWeight: 500 }}>{item.userName || item.userId}</span>
                      </div>
                      <Progress
                        percent={Math.min(item.progress || 0, 100)}
                        size="small"
                        status={item.progress >= 100 ? 'success' : 'active'}
                        format={(p) => `${p?.toFixed(1)}%`}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', marginTop: 4 }}>
                        <span>目标: ¥{(item.targetAmount || 0).toFixed(2)}</span>
                        <span>实际: ¥{(item.actualAmount || 0).toFixed(2)}</span>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          )}

          <Card
            title="最近操作记录"
            loading={logsLoading}
            style={{ marginTop: 16 }}
          >
            {logs.length === 0 ? (
              <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>
                暂无操作记录
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {logs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14 }}>
                        <Tag
                          color={
                            log.status === 'success' ? 'success' : 'error'
                          }
                        >
                          {log.status === 'success' ? '成功' : '失败'}
                        </Tag>
                        <span style={{ marginLeft: 8, fontWeight: 500 }}>
                          {log.action}
                        </span>
                        <span style={{ color: '#666', marginLeft: 4 }}>
                          {log.resource}
                        </span>
                      </div>
                      {log.errorMessage && (
                        <div
                          style={{
                            fontSize: 12,
                            color: '#ff4d4f',
                            marginTop: 4,
                          }}
                        >
                          {log.errorMessage}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#999',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDateTime(log.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
