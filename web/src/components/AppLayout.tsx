import { Layout, Menu, Avatar, Dropdown, Space, Breadcrumb } from 'antd';
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  BarChartOutlined,
  DownOutlined,
  TeamOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

const items = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/customers', icon: <TeamOutlined />, label: '客户管理' },
  { key: '/products', icon: <AppstoreOutlined />, label: '产品管理' },
  { key: '/sales-orders', icon: <ShoppingCartOutlined />, label: '销售订单' },
  { key: '/approvals', icon: <FileTextOutlined />, label: '审批中心' },
  { key: '/reports', icon: <BarChartOutlined />, label: '报表分析' },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('erp_token');
    navigate('/login');
  };

  const menuItems = [
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
                  items.find((i) => i.key === location.pathname)?.label || '',
              },
            ]}
          />
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#1890ff' }}>A</Avatar>
              <span>管理员</span>
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
