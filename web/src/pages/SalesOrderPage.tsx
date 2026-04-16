import { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Space, message } from 'antd';
import StatusTag from '@/components/StatusTag';
import SalesOrderFormDrawer from '@/components/SalesOrderFormDrawer';
import { fetchSalesOrders, submitSalesOrder } from '@/api/sales';
import { FEISHU_APPROVAL_DEF_CODE } from '@/config';

export default function SalesOrderPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchSalesOrders({ keyword, status });
      setData(res);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (id: string) => {
    const feishuUserId = localStorage.getItem('erp_feishu_user_id');
    if (!feishuUserId) {
      message.error('未绑定飞书 User ID，请联系管理员');
      return;
    }
    try {
      await submitSalesOrder(id, {
        feishuUserId,
        approvalDefCode: FEISHU_APPROVAL_DEF_CODE,
      });
      message.success('提交审批成功');
      loadData();
    } catch {
      message.error('提交失败');
    }
  };

  const columns = [
    { title: '订单号', dataIndex: 'id', key: 'id' },
    {
      title: '客户',
      key: 'customer',
      render: (_: any, record: any) => record.customer?.name || '-',
    },
    {
      title: '下单时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => v?.replace('T', ' ').slice(0, 19),
    },
    {
      title: '应付金额',
      dataIndex: 'payAmount',
      key: 'payAmount',
      render: (v: any) => `¥${parseFloat(v || 0).toFixed(2)}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <StatusTag status={v} />,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link">查看</Button>
          {record.status === 'draft' && (
            <Button type="link" onClick={() => handleSubmit(record.id)}>
              提交审批
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Space>
          <Input
            placeholder="订单号/客户"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 200 }}
          />
          <Select
            placeholder="全部状态"
            value={status}
            onChange={setStatus}
            style={{ width: 120 }}
            allowClear
          >
            <Select.Option value="draft">草稿</Select.Option>
            <Select.Option value="pending_approval">待审批</Select.Option>
            <Select.Option value="approved">已通过</Select.Option>
            <Select.Option value="completed">已完成</Select.Option>
          </Select>
          <Button type="primary" onClick={loadData}>
            查询
          </Button>
        </Space>
        <Button type="primary" onClick={() => setDrawerOpen(true)}>
          + 新建订单
        </Button>
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
      />
      <SalesOrderFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
