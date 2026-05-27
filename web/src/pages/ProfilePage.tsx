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
} from 'antd';
import {
  UserOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  WarningOutlined,
  StockOutlined,
  EditOutlined,
  LockOutlined,
  CheckCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import PageHeader from '@/components/PageHeader';
import { fetchMe, updateMe, fetchDashboard } from '@/api/users';
import type { UserProfile, DashboardStats } from '@/api/users';

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [pwdMode, setPwdMode] = useState(false);
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();

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
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
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
      await updateMe({ password: values.newPassword });
      message.success('密码修改成功');
      setPwdMode(false);
      pwdForm.resetFields();
    } catch (err: any) {
      message.error(err?.message || '修改失败');
    }
  };

  const roleMap: Record<string, string> = {
    admin: '管理员',
    user: '普通用户',
  };

  const statCards = [
    {
      title: '本月订单',
      value: stats?.myOrdersThisMonth?.count || 0,
      suffix: `笔 ¥${(stats?.myOrdersThisMonth?.amount || 0).toFixed(2)}`,
      icon: <ShoppingCartOutlined style={{ fontSize: 24, color: '#1677ff' }} />,
    },
    {
      title: '待审批订单',
      value: (stats?.pendingApprovals?.salesOrders || 0) + (stats?.pendingApprovals?.purchaseOrders || 0) + (stats?.pendingApprovals?.purchaseRequests || 0),
      suffix: '笔',
      icon: <FileTextOutlined style={{ fontSize: 24, color: '#faad14' }} />,
      detail: stats
        ? [
            `销售订单: ${stats.pendingApprovals.salesOrders}`,
            `采购单: ${stats.pendingApprovals.purchaseOrders}`,
            `采购申请: ${stats.pendingApprovals.purchaseRequests}`,
          ]
        : [],
    },
    {
      title: '交期预警',
      value: stats?.deliveryWarnings || 0,
      suffix: '笔',
      icon: <WarningOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />,
    },
    {
      title: '缺货 SKU',
      value: stats?.lowStockSkus || 0,
      suffix: '个',
      icon: <StockOutlined style={{ fontSize: 24, color: '#eb2f96' }} />,
    },
  ];

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
                      </Space>
                    ) : (
                      <Space>
                        <WarningOutlined style={{ color: '#ff4d4f' }} />
                        <span style={{ color: '#ff4d4f' }}>未绑定</span>
                      </Space>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="聚水潭店铺">
                    {user?.jushuitanShopId || (
                      <span style={{ color: '#999' }}>未配置</span>
                    )}
                  </Descriptions.Item>
                </Descriptions>
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
                    {card.detail && card.detail.length > 0 && (
                      <div
                        style={{
                          fontSize: 12,
                          color: '#888',
                          lineHeight: 1.8,
                          textAlign: 'right',
                        }}
                      >
                        {card.detail.map((d) => (
                          <div key={d}>{d}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

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
        </Col>
      </Row>
    </div>
  );
}
