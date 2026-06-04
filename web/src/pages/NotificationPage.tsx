import { useEffect, useState } from 'react';
import { List, Badge, Button, Empty, Tabs, Tag, message } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import axios from '@/api/axios';
import PageHeader from '@/components/PageHeader';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  relatedId?: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationPage() {
  const [data, setData] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/notifications', {
        params:
          activeTab === 'unread' ? { isRead: 'false' } : undefined,
      });
      setData(res.data?.data || []);
    } catch {
      message.error('加载消息失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [activeTab]);

  const markAsRead = async (id: string) => {
    try {
      await axios.patch(`/notifications/${id}/read`);
      setData((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    } catch {
      message.error('标记已读失败');
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post('/notifications/read-all');
      setData((prev) => prev.map((n) => ({ ...n, isRead: true })));
      message.success('全部已读');
    } catch {
      message.error('操作失败');
    }
  };

  const typeColorMap: Record<string, string> = {
    sku_sync_failed: 'error',
    bom_sync_failed: 'error',
    order_push_failed: 'warning',
    system: 'default',
  };

  const typeLabelMap: Record<string, string> = {
    sku_sync_failed: 'SKU同步',
    bom_sync_failed: 'BOM同步',
    order_push_failed: '订单推送',
    system: '系统',
  };

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="消息通知">
        <Button icon={<CheckOutlined />} onClick={markAllAsRead}>
          全部已读
        </Button>
      </PageHeader>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'all', label: '全部' },
          { key: 'unread', label: '未读' },
        ]}
      />

      <List
        loading={loading}
        dataSource={data}
        renderItem={(item) => (
          <List.Item
            actions={[
              !item.isRead && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => markAsRead(item.id)}
                >
                  标记已读
                </Button>
              ),
            ]}
          >
            <List.Item.Meta
              avatar={
                <Badge dot={!item.isRead}>
                  <BellOutlined
                    style={{
                      fontSize: 20,
                      color: item.isRead ? '#999' : '#1890ff',
                    }}
                  />
                </Badge>
              }
              title={
                <span>
                  <Tag color={typeColorMap[item.type] || 'default'}>
                    {typeLabelMap[item.type] || item.type}
                  </Tag>
                  {item.title}
                </span>
              }
              description={
                <div>
                  <div style={{ color: '#666', marginTop: 4 }}>
                    {item.content}
                  </div>
                  <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                </div>
              }
            />
          </List.Item>
        )}
        locale={{
          emptyText: <Empty description="暂无消息" />,
        }}
      />
    </div>
  );
}
