import { useState } from 'react';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Space,
  Breadcrumb,
  Button,
  Grid,
} from 'antd';
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
  ShopOutlined,
  ShoppingOutlined,
  BuildOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { hasPermission } from '@/utils/permissions';

const { Header, Sider, Content } = Layout;

const allItems: any[] = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  {
    key: 'sales',
    icon: <ShoppingCartOutlined />,
    label: '销售',
    children: [
      {
        key: '/customers',
        icon: <TeamOutlined />,
        label: '客户管理',
        permission: 'customer:view',
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
    ],
  },
  {
    key: 'supply-chain',
    icon: <AppstoreOutlined />,
    label: '供应链',
    children: [
      {
        key: '/products',
        icon: <AppstoreOutlined />,
        label: '商品管理',
        permission: 'product:view',
      },
      {
        key: '/suppliers',
        icon: <ShopOutlined />,
        label: '供应商管理',
        permission: 'supplier:view',
      },
      {
        key: '/purchase-orders',
        icon: <ShoppingOutlined />,
        label: '采购单管理',
        permission: 'purchase_order:view',
      },
      {
        key: '/production-orders',
        icon: <BuildOutlined />,
        label: '加工入库',
        permission: 'production_order:view',
      },
      {
        key: '/boms',
        icon: <BuildOutlined />,
        label: 'BOM 管理',
        permission: 'bom:view',
      },
      {
        key: '/material-categories',
        icon: <AppstoreOutlined />,
        label: '物料分类',
        permission: 'material_category:view',
      },
    ],
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
    key: '/operation-logs',
    icon: <HistoryOutlined />,
    label: '操作日志',
    permission: 'admin:users',
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

  const filterItems = (list: any[]): any[] => {
    return list
      .map((item) => {
        if (item.children) {
          const filteredChildren = filterItems(item.children);
          if (filteredChildren.length === 0) return null;
          return { ...item, children: filteredChildren };
        }
        if (!item.permission || hasPermission(item.permission)) {
          return item;
        }
        return null;
      })
      .filter(Boolean);
  };

  const items = filterItems(allItems);

  const findLabel = (pathname: string, list: any[]): string => {
    for (const item of list) {
      if (item.key === pathname) return item.label;
      if (item.children) {
        const found = findLabel(pathname, item.children);
        if (found) return found;
      }
    }
    return '';
  };

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
          items={items.map((i) => {
            if (i.children) {
              return {
                key: i.key,
                icon: i.icon,
                label: i.label,
                children: i.children.map((c: any) => ({
                  key: c.key,
                  icon: c.icon,
                  label: <Link to={c.key}>{c.label}</Link>,
                })),
              };
            }
            return {
              key: i.key,
              icon: i.icon,
              label: <Link to={i.key}>{i.label}</Link>,
            };
          })}
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
                    title: findLabel(location.pathname, items),
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
