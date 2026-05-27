import { useEffect, useMemo, useState } from 'react';
import { Table, Button, Input, Select, Space, message, DatePicker } from 'antd';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '@/components/PageHeader';
import StatusTag from '@/components/StatusTag';
import SalesOrderFormDrawer from '@/components/SalesOrderFormDrawer';
import SalesOrderDetailModal from '@/components/SalesOrderDetailModal';
import {
  fetchSalesOrders,
  fetchSalesOrderById,
  submitSalesOrder,
} from '@/api/sales';
import { hasPermission } from '@/utils/permissions';
import { formatDateTime } from '@/utils/datetime';
import { fetchUserProfile } from '@/api/users';
import { FEISHU_APPROVAL_DEF_CODE } from '@/config';
import type { SalesOrder } from '@/types';

const { RangePicker } = DatePicker;

export default function SalesOrderPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [salespersonId, setSalespersonId] = useState(
    searchParams.get('salespersonId') || '',
  );
  const [dateRange, setDateRange] = useState<[string, string] | null>(
    searchParams.get('dateFrom') && searchParams.get('dateTo')
      ? [searchParams.get('dateFrom')!, searchParams.get('dateTo')!]
      : null,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [feishuUserId, setFeishuUserId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const loadData = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const params: any = {
        keyword,
        status,
        page: p,
        pageSize: ps,
      };
      if (salespersonId) params.salespersonId = salespersonId;
      if (dateRange) {
        params.dateFrom = dateRange[0];
        params.dateTo = dateRange[1];
      }
      const res = await fetchSalesOrders(params);
      setData(res.data);
      setTotal(res.total ?? 0);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  // Sync URL params to state on mount / URL change
  useEffect(() => {
    setKeyword(searchParams.get('keyword') || '');
    setStatus(searchParams.get('status') || '');
    setSalespersonId(searchParams.get('salespersonId') || '');
    const df = searchParams.get('dateFrom');
    const dt = searchParams.get('dateTo');
    setDateRange(df && dt ? [df, dt] : null);
  }, [searchParams]);

  // Load data when URL query params change (e.g., drill-down from dashboard)
  useEffect(() => {
    const loadFromUrl = async () => {
      setLoading(true);
      try {
        const params: any = {
          keyword: searchParams.get('keyword') || '',
          status: searchParams.get('status') || '',
          page,
          pageSize,
        };
        const sId = searchParams.get('salespersonId');
        const df = searchParams.get('dateFrom');
        const dt = searchParams.get('dateTo');
        if (sId) params.salespersonId = sId;
        if (df && dt) {
          params.dateFrom = df;
          params.dateTo = dt;
        }
        const res = await fetchSalesOrders(params);
        setData(res.data);
        setTotal(res.total ?? 0);
      } catch {
        message.error('加载失败');
      } finally {
        setLoading(false);
      }
    };
    loadFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString(), page, pageSize]);

  // Load Feishu user info once on mount
  useEffect(() => {
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

  const sortedData = useMemo(() => {
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'payAmount') {
        comparison = (a.payAmount || 0) - (b.payAmount || 0);
      } else if (sortField === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [data, sortField, sortOrder]);

  const columns = [
    { title: '订单号', dataIndex: 'id', key: 'id', width: 180, ellipsis: true },
    {
      title: '订单类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      ellipsis: true,
      render: (v: string) => orderTypeMap[v] || v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
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
      title: '客户',
      key: 'customer',
      width: 120,
      ellipsis: true,
      render: (_: any, record: any) => record.customer?.name || '-',
    },
    {
      title: '业务员',
      key: 'salesperson',
      width: 80,
      ellipsis: true,
      render: (_: any, record: any) => record.salesperson?.name || '-',
    },
    {
      title: '应付金额',
      dataIndex: 'payAmount',
      key: 'payAmount',
      width: 100,
      ellipsis: true,
      render: (v: any) => `¥${parseFloat(v || 0).toFixed(2)}`,
    },
    {
      title: '交期/账期',
      dataIndex: 'deliveryDate',
      key: 'deliveryDate',
      width: 120,
      ellipsis: true,
      render: (_v: string, record: any) => {
        const warnings = [];
        if (record.creditWarning) warnings.push('信');
        if (record.floorPriceWarning) warnings.push('底');
        if (record.deliveryWarning) warnings.push('交');
        const remaining =
          (record.payAmount || 0) -
          (record.collectedAmount || 0) -
          (record.prepaymentDeducted || 0);
        const isOverdue =
          record.paymentDueDate &&
          remaining > 0.01 &&
          new Date(record.paymentDueDate) < new Date();
        return (
          <span>
            {record.deliveryDate
              ? new Date(record.deliveryDate).toLocaleDateString('zh-CN')
              : '-'}
            {warnings.length > 0 && (
              <span style={{ color: '#ff4d4f', marginLeft: 4, fontSize: 12 }}>
                ({warnings.join(',')})
              </span>
            )}
            {isOverdue && (
              <span style={{ color: '#ff4d4f', marginLeft: 4, fontSize: 12 }}>
                逾期
              </span>
            )}
          </span>
        );
      },
    },
    {
      title: '下单时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      ellipsis: true,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space wrap={false} size={4}>
          <Button type="link" size="small" onClick={() => handleView(record)}>
            查看
          </Button>
          {(record.status === 'draft' || record.status === 'approved') && (
            <>
              {hasPermission('order:edit') && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleEdit(record)}
                >
                  编辑
                </Button>
              )}
              {record.status === 'draft' && hasPermission('order:submit') && (
                <Button
                  type="link"
                  size="small"
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
    <div style={{ width: '100%', height: 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="销售订单">
        <Button type="primary" onClick={() => setDrawerOpen(true)}>
          + 新建订单
        </Button>
      </PageHeader>
      <Space wrap style={{ marginBottom: 16, flexShrink: 0 }} className="page-search-bar">
        <Input
          placeholder="订单号/客户"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={() => {
            setPage(1);
            loadData(1, pageSize);
          }}
          style={{ width: 200 }}
        />
        <Select
          placeholder="全部状态"
          value={status || undefined}
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
        <RangePicker
          value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
          onChange={(dates) => {
            if (dates && dates[0] && dates[1]) {
              setDateRange([
                dates[0].format('YYYY-MM-DD'),
                dates[1].format('YYYY-MM-DD'),
              ]);
            } else {
              setDateRange(null);
            }
          }}
          style={{ width: 260 }}
        />
        <Select
          placeholder="排序字段"
          value={sortField || undefined}
          onChange={setSortField}
          style={{ width: 120 }}
          allowClear
        >
          <Select.Option value="payAmount">应付金额</Select.Option>
          <Select.Option value="createdAt">下单时间</Select.Option>
        </Select>
        <Select
          placeholder="排序方向"
          value={sortOrder}
          onChange={setSortOrder}
          style={{ width: 100 }}
          options={[
            { value: 'asc', label: '升序' },
            { value: 'desc', label: '降序' },
          ]}
        />
        <Button
          type="primary"
          onClick={() => {
            setPage(1);
            loadData(1, pageSize);
          }}
        >
          查询
        </Button>
        {(keyword || status || salespersonId || dateRange) && (
          <Button
            onClick={() => {
              setKeyword('');
              setStatus('');
              setSalespersonId('');
              setDateRange(null);
              setSearchParams({});
            }}
          >
            重置
          </Button>
        )}
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={sortedData}
        loading={loading}
        scroll={{ x: 1000, y: 'calc(100vh - 360px)' }}
        style={{ width: '100%' }}
        sticky
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
            loadData(p, ps);
          },
        }}
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
