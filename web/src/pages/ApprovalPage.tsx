import React, { useEffect, useState } from 'react';
import { Card, Button, Tabs, Space, message, Empty } from 'antd';
import { fetchApprovals, approve, reject } from '@/api/approvals';
import StatusTag from '@/components/StatusTag';

export default function ApprovalPage() {
  const [tab, setTab] = useState('pending');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: any = {};
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
  }, [tab]);

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
    <div>
      <Tabs activeKey={tab} onChange={setTab} items={tabItems} />
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
                  销售订单审批 {item.instanceCode}
                </div>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                  订单: {item.salesOrderId} · 创建时间:{' '}
                  {item.createdAt?.replace('T', ' ').slice(0, 19)}
                </div>
                <div style={{ marginTop: 4 }}>
                  <StatusTag status={item.status || item.feishuStatus} />
                </div>
              </div>
              {tab === 'pending' && (
                <Space>
                  <Button
                    type="primary"
                    onClick={() => handleApprove(item.instanceCode)}
                  >
                    通过
                  </Button>
                  <Button
                    danger
                    onClick={() => handleReject(item.instanceCode)}
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
