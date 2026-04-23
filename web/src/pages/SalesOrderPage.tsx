import { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Space, message } from 'antd';
import StatusTag from '@/components/StatusTag';
import SalesOrderFormDrawer from '@/components/SalesOrderFormDrawer';
import SalesOrderDetailModal from '@/components/SalesOrderDetailModal';
import {
  fetchSalesOrders,
  fetchSalesOrderById,
  submitSalesOrder,
} from '@/api/sales';
import { hasPermission } from '@/utils/permissions';
import { fetchUserProfile } from '@/api/users';
import { FEISHU_APPROVAL_DEF_CODE } from '@/config';
import type { SalesOrder } from '@/types';

export default function SalesOrderPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [feishuUserId, setFeishuUserId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchSalesOrders({
        keyword,
        status,
        page: 1,
        pageSize: 100,
      });
      setData(res.data);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const cached = localStorage.getItem('erp_feishu_user_id');
    if (cached) {
      setFeishuUserId(cached);
      return;
    }
    const username = localStorage.getItem('erp_username');
    if (username) {
      fetchUserProfile(username)
        .then((profile) => {
          if (profile.feishuUserId) {
            localStorage.setItem('erp_feishu_user_id', profile.feishuUserId);
            localStorage.setItem('erp_feishu_user_id_type', 'user_id');
            setFeishuUserId(profile.feishuUserId);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleSubmit = async (id: string) => {
    if (submittingId) return;
    const userId = feishuUserId || localStorage.getItem('erp_feishu_user_id');
    const userIdType =
      localStorage.getItem('erp_feishu_user_id_type') || 'user_id';
    if (!userId || userIdType !== 'user_id') {
      message.error(
        '当前账号未绑定飞书 User ID，请联系管理员在「系统管理-用户管理」中补充飞书 User ID（员工编号）',
      );
      return;
    }
    setSubmittingId(id);
    try {
      await submitSalesOrder(id, {
        feishuUserId: userId,
        feishuUserIdType: userIdType,
        approvalDefCode: FEISHU_APPROVAL_DEF_CODE,
      });
      message.success('提交审批成功');
      loadData();
    } catch (err: any) {
      message.error(err?.message || '提交失败');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleView = async (record: SalesOrder) => {
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const order = await fetchSalesOrderById(record.id);
      setSelectedOrder(order);
    } catch {
      message.error('加载订单详情失败');
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);

  const handleEdit = (record: SalesOrder) => {
    setEditingOrder(record);
    setDrawerOpen(true);
  };

  const refreshOrderDetail = async (orderId: string): Promise<SalesOrder> => {
    const order = await fetchSalesOrderById(orderId);
    setSelectedOrder(order);
    return order;
  };

  const orderTypeMap: Record<string, string> = {
    sales: '销售订单',
    overseas: '海外提货单',
  };

  const columns = [
    { title: '订单号', dataIndex: 'id', key: 'id' },
    {
      title: '订单类型',
      dataIndex: 'type',
      key: 'type',
      render: (v: string) => orderTypeMap[v] || v || '-',
    },
    {
      title: '客户',
      key: 'customer',
      render: (_: any, record: any) => record.customer?.name || '-',
    },
    {
      title: '签单人',
      key: 'signer',
      render: (_: any, record: any) => record.signer?.name || '-',
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
      render: (v: string, record: any) => (
        <StatusTag
          status={v}
          collectedAmount={record.collectedAmount}
          payAmount={record.payAmount}
          prepaymentDeducted={record.prepaymentDeducted}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" onClick={() => handleView(record)}>
            查看
          </Button>
          {record.status === 'draft' && (
            <>
              {hasPermission('order:edit') && (
                <Button type="link" onClick={() => handleEdit(record)}>
                  编辑
                </Button>
              )}
              {hasPermission('order:submit') && (
                <Button
                  type="link"
                  loading={submittingId === record.id}
                  disabled={submittingId === record.id}
                  onClick={() => handleSubmit(record.id)}
                >
                  提交审批
                </Button>
              )}
            </>
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
            style={{ width: 140 }}
            allowClear
          >
            <Select.Option value="draft">草稿</Select.Option>
            <Select.Option value="pending_approval">待批准</Select.Option>
            <Select.Option value="approved">待回款</Select.Option>
            <Select.Option value="rejected">已驳回</Select.Option>
            <Select.Option value="completed">已回款</Select.Option>
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
        onClose={() => {
          setDrawerOpen(false);
          setEditingOrder(null);
        }}
        onSuccess={loadData}
        editingOrder={editingOrder}
      />
      <SalesOrderDetailModal
        open={detailModalOpen}
        order={selectedOrder}
        loading={detailLoading}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedOrder(null);
        }}
        onSuccess={loadData}
        onEditOrder={(order) => {
          setDetailModalOpen(false);
          setSelectedOrder(null);
          handleEdit(order);
        }}
        onRefreshOrder={refreshOrderDetail}
      />
    </div>
  );
}
