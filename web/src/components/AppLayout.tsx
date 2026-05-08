import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Breadcrumb, Button, Grid } from 'antd';
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
  MenuFoldOutlined,
  MenuUnfoldOutlined,
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
    label: '商品库存',
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

const { useBreakpoint } = Grid;

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const role = localStorage.getItem('erp_role') || 'user';
  const username = localStorage.getItem('erp_username') || '用户';
  const avatarUrl = localStorage.getItem('erp_avatar') || '';
  const [collapsed, setCollapsed] = useState(false);

  const items = allItems.filter(
    (i: any) => !i.permission || hasPermission(i.permission),
  );

  const handleLogout = () => {
    localStorage.removeItem('erp_token');
    localStorage.removeItem('erp_username');
    localStorage.removeItem('erp_role');
    localStorage.removeItem('erp_permissions');
    localStorage.removeItem('erp_feishu_user_id');
    localStorage.removeItem('erp_feishu_user_id_type');
    localStorage.removeItem('erp_avatar');
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
    <Layout style={{ minHeight: '100vh', background: '#F7F7F8' }}>
      <Sider
        theme="light"
        width={240}
        breakpoint="lg"
        collapsedWidth={64}
        collapsible
        collapsed={collapsed}
        onCollapse={(v) => setCollapsed(v)}
        trigger={null}
        style={{
          background: '#F7F7F8',
          borderRight: '1px solid #EBEBEC',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            fontWeight: 700,
            fontSize: 16,
            color: '#111111',
            borderBottom: '1px solid #EBEBEC',
          }}
        >
          Sales ERP
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          style={{
            borderRight: 'none',
            background: 'transparent',
            paddingTop: 8,
          }}
          items={items.map((i) => ({
            key: i.key,
            icon: i.icon,
            label: <Link to={i.key}>{i.label}</Link>,
          }))}
        />
      </Sider>
      <Layout style={{ background: 'transparent' }}>
        <Header
          style={{
            background: '#FFFFFF',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #EBEBEC',
            height: 56,
          }}
        >
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            {!isMobile && (
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
            )}
          </Space>
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              {avatarUrl ? (
                <Avatar src={avatarUrl} />
              ) : (
                <Avatar
                  style={{
                    backgroundColor: '#EBEBEC',
                    color: '#6E6E6E',
                    fontWeight: 600,
                  }}
                >
                  {username.charAt(0).toUpperCase()}
                </Avatar>
              )}
              {!isMobile && (
                <span style={{ color: '#111111', fontWeight: 500 }}>
                  {username}
                </span>
              )}
              <DownOutlined style={{ color: '#A0A0A0', fontSize: 12 }} />
            </Space>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: 24,
            padding: 24,
            background: '#FFFFFF',
            borderRadius: 8,
            border: '1px solid #EBEBEC',
            minHeight: 360,
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
