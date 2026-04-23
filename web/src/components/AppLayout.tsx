import { Layout, Menu, Avatar, Dropdown, Space, Breadcrumb } from 'antd';
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  BarChartOutlined,
  DownOutlined,
  TeamOutlined,
  AppstoreOutlined,
  SettingOutlined,
  MoneyCollectOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { hasPermission } from '@/utils/permissions';

const { Header, Sider, Content } = Layout;

const allItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  {
    key: '/customers',
    icon: <TeamOutlined />,
    label: '客户管理',
    permission: 'customer:view',
  },
  {
    key: '/products',
    icon: <AppstoreOutlined />,
    label: '产品管理',
    permission: 'product:view',
  },
  {
    key: '/sales-orders',
    icon: <ShoppingCartOutlined />,
    label: '销售订单',
    permission: 'order:view',
  },
  {
    key: '/prepayments',
    icon: <MoneyCollectOutlined />,
    label: '预付款管理',
    permission: 'prepayment:view',
  },
  {
    key: '/approvals',
    icon: <FileTextOutlined />,
    label: '审批中心',
    permission: 'approval:view',
  },
  {
    key: '/reports',
    icon: <BarChartOutlined />,
    label: '报表分析',
    permission: 'report:view',
  },
  {
    key: '/admin',
    icon: <SettingOutlined />,
    label: '系统管理',
    permission: 'admin:users',
  },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const role = localStorage.getItem('erp_role') || 'user';
  const username = localStorage.getItem('erp_username') || '用户';

  const items = allItems.filter(
    (i: any) => !i.permission || hasPermission(i.permission),
  );

  const handleLogout = () => {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_username');
    localStorage.removeItem('erp_role');
    localStorage.removeItem('erp_feishu_user_id');
    navigate('/login');
  };

  const menuItems = [
    {
      key: 'role',
      label: <span>角色：{role === 'admin' ? '管理员' : '普通用户'}</span>,
      disabled: true,
    },
    { key: 'logout', label: <span onClick={handleLogout}>退出登录</span> },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={200}>
        <div
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          Sales ERP
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items.map((i) => ({
            key: i.key,
            icon: i.icon,
            label: <Link to={i.key}>{i.label}</Link>,
          }))}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Breadcrumb
            items={[
              { title: '首页' },
              {
                title:
                  items.find((i: any) => i.key === location.pathname)?.label ||
                  '',
              },
            ]}
          />
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#1890ff' }}>
                {username.charAt(0).toUpperCase()}
              </Avatar>
              <span>{username}</span>
              <DownOutlined />
            </Space>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: 16,
            padding: 16,
            background: '#f5f7fa',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 24,
              borderRadius: 8,
              minHeight: 360,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
