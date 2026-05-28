import { useEffect, useState } from 'react';
import { Card, Button, Tabs, Space, message, Empty, Input, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { fetchApprovals, approve, reject } from '@/api/approvals';
import StatusTag from '@/components/StatusTag';
import { formatDateTime } from '@/utils/datetime';

export default function ApprovalPage() {
  const [tab, setTab] = useState('pending');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {
        keyword: keyword || undefined,
        sortField,
        sortOrder,
      };
      if (tab === 'pending') params.status = 'pending';
      const res = await fetchApprovals(params);
      setData(res);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sortField, sortOrder]);

  const handleApprove = async (code: string) => {
    try {
      await approve(code);
      message.success('审批通过');
      loadData();
    } catch {
      message.error('操作失败');
    }
  };

  const handleReject = async (code: string) => {
    try {
      await reject(code);
      message.success('已拒绝');
      loadData();
    } catch {
      message.error('操作失败');
    }
  };

  const tabItems = [
    { key: 'pending', label: '待我审批' },
    { key: 'approved', label: '我已审批' },
    { key: 'submitted', label: '我发起的' },
  ];

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Tabs activeKey={tab} onChange={setTab} items={tabItems} />
        <Space>
          <Input.Search
            placeholder="搜索订单号/类型"
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={() => loadData()}
            style={{ width: 220 }}
            prefix={<SearchOutlined />}
          />
          <Select
            value={`${sortField}-${sortOrder}`}
            onChange={(v) => {
              const [field, order] = v.split('-');
              setSortField(field);
              setSortOrder(order as 'ASC' | 'DESC');
            }}
            style={{ width: 140 }}
            options={[
              { label: '创建时间 ↓', value: 'createdAt-DESC' },
              { label: '创建时间 ↑', value: 'createdAt-ASC' },
            ]}
          />
        </Space>
      </div>
      <Space direction="vertical" style={{ width: '100%' }}>
        {data.length === 0 && <Empty description="暂无数据" />}
        {data.map((item) => (
          <Card key={item.id} loading={loading}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  销售订单审批 {item.feishu_instance_code}
                </div>
                <div style={{ fontSize: 12, color: '#A0A0A0' }}>
                  订单: {item.sales_order_id} · 创建时间:{' '}
                  {formatDateTime(item.createdAt)}
                </div>
                <div style={{ marginTop: 4 }}>
                  <StatusTag status={item.status} />
                </div>
              </div>
              {tab === 'pending' && (
                <Space>
                  <Button
                    type="primary"
                    onClick={() => handleApprove(item.feishu_instance_code)}
                  >
                    通过
                  </Button>
                  <Button
                    danger
                    onClick={() => handleReject(item.feishu_instance_code)}
                  >
                    拒绝
                  </Button>
                </Space>
              )}
            </div>
          </Card>
        ))}
      </Space>
    </div>
  );
}
