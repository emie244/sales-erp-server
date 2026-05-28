import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Descriptions,
  Tag,
  message,
  Input,
  Select,
  Space,
} from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { fetchCustomerStatement } from '@/api/sales';
import type { CustomerStatementItem } from '@/api/sales';
import PageHeader from '@/components/PageHeader';

export default function CustomerStatementPage() {
  const [data, setData] = useState<CustomerStatementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [sortField, setSortField] = useState<
    'outstanding' | 'customerName' | 'totalPayAmount'
  >('outstanding');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCustomer, setDetailCustomer] =
    useState<CustomerStatementItem | null>(null);
  const [detailOrders, setDetailOrders] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchCustomerStatement({
        keyword: keyword || undefined,
      });
      let sorted = [...(res.summary || [])];
      sorted.sort((a, b) => {
        let cmp = 0;
        if (sortField === 'customerName') {
          cmp = a.customerName.localeCompare(b.customerName);
        } else if (sortField === 'totalPayAmount') {
          cmp = a.totalPayAmount - b.totalPayAmount;
        } else {
          cmp = a.outstanding - b.outstanding;
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
      setData(sorted);
    } catch {
      message.error('加载对账单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortOrder]);

  const handleSearch = () => {
    loadData();
  };

  const handleReset = () => {
    setKeyword('');
    setSortField('outstanding');
    setSortOrder('desc');
    loadData();
  };

  const handleViewDetail = async (item: CustomerStatementItem) => {
    setDetailCustomer(item);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetchCustomerStatement({ customerId: item.customerId });
      setDetailOrders(res.orders || []);
    } catch {
      message.error('加载明细失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    {
      title: '客户',
      dataIndex: 'customerName',
      key: 'customerName',
      render: (v: string) => v || '-',
    },
    {
      title: '订单总额',
      dataIndex: 'totalPayAmount',
      key: 'totalPayAmount',
      align: 'right' as const,
      render: (v: number) => `¥${(v || 0).toFixed(2)}`,
    },
    {
      title: '已开票',
      dataIndex: 'totalInvoiced',
      key: 'totalInvoiced',
      align: 'right' as const,
      render: (v: number) => `¥${(v || 0).toFixed(2)}`,
    },
    {
      title: '已回款',
      dataIndex: 'totalCollected',
      key: 'totalCollected',
      align: 'right' as const,
      render: (v: number) => `¥${(v || 0).toFixed(2)}`,
    },
    {
      title: '预付款抵扣',
      dataIndex: 'totalPrepayment',
      key: 'totalPrepayment',
      align: 'right' as const,
      render: (v: number) => `¥${(v || 0).toFixed(2)}`,
    },
    {
      title: '未核销余额',
      dataIndex: 'outstanding',
      key: 'outstanding',
      align: 'right' as const,
      render: (v: number) => (
        <span
          style={{
            color: v > 0.01 ? '#ff4d4f' : undefined,
            fontWeight: 'bold',
          }}
        >
          ¥{(v || 0).toFixed(2)}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: CustomerStatementItem) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          查看明细
        </Button>
      ),
    },
  ];

  const orderColumns = [
    {
      title: '订单号',
      dataIndex: 'id',
      key: 'id',
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const map: Record<string, string> = {
          approved: '已批准',
          synced_jst: '已同步',
          shipped: '已发货',
          completed: '已完成',
        };
        return <Tag>{map[v] || v}</Tag>;
      },
    },
    {
      title: '应付金额',
      dataIndex: 'payAmount',
      key: 'payAmount',
      align: 'right' as const,
      render: (v: number) => `¥${(v || 0).toFixed(2)}`,
    },
    {
      title: '已回款',
      dataIndex: 'collectedAmount',
      key: 'collectedAmount',
      align: 'right' as const,
      render: (v: number) => `¥${(v || 0).toFixed(2)}`,
    },
    {
      title: '预付款抵扣',
      dataIndex: 'prepaymentDeducted',
      key: 'prepaymentDeducted',
      align: 'right' as const,
      render: (v: number) => `¥${(v || 0).toFixed(2)}`,
    },
    {
      title: '已开票',
      dataIndex: 'invoicedAmount',
      key: 'invoicedAmount',
      align: 'right' as const,
      render: (v: number) => `¥${(v || 0).toFixed(2)}`,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div
      style={{
        width: '100%',
        height: 'calc(100vh - 104px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <PageHeader title="客户对账单" />

      <Space
        wrap
        style={{ marginBottom: 16, flexShrink: 0 }}
        className="page-search-bar"
      >
        <Input.Search
          placeholder="搜索客户名称"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={handleSearch}
          style={{ width: 260 }}
          allowClear
        />
        <Select
          placeholder="排序字段"
          value={sortField}
          onChange={(v) => setSortField(v)}
          style={{ width: 140 }}
          options={[
            { label: '未核销余额', value: 'outstanding' },
            { label: '客户名称', value: 'customerName' },
            { label: '订单总额', value: 'totalPayAmount' },
          ]}
        />
        <Select
          placeholder="排序方式"
          value={sortOrder}
          onChange={(v) => setSortOrder(v)}
          style={{ width: 120 }}
          options={[
            { label: '降序', value: 'desc' },
            { label: '升序', value: 'asc' },
          ]}
        />
        <Button onClick={handleSearch}>查询</Button>
        <Button onClick={handleReset}>重置</Button>
      </Space>

      <Table
        rowKey="customerId"
        columns={columns}
        dataSource={data}
        loading={loading}
        sticky
        pagination={false}
        scroll={{ x: 1000, y: 'calc(100vh - 360px)' }}
        summary={(pageData) => {
          const totalPay = pageData.reduce(
            (sum, r) => sum + (r.totalPayAmount || 0),
            0,
          );
          const totalInvoiced = pageData.reduce(
            (sum, r) => sum + (r.totalInvoiced || 0),
            0,
          );
          const totalCollected = pageData.reduce(
            (sum, r) => sum + (r.totalCollected || 0),
            0,
          );
          const totalPrepayment = pageData.reduce(
            (sum, r) => sum + (r.totalPrepayment || 0),
            0,
          );
          const totalOutstanding = pageData.reduce(
            (sum, r) => sum + (r.outstanding || 0),
            0,
          );
          return (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}>
                <strong>合计</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <strong>¥{totalPay.toFixed(2)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                <strong>¥{totalInvoiced.toFixed(2)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                <strong>¥{totalCollected.toFixed(2)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                <strong>¥{totalPrepayment.toFixed(2)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <strong style={{ color: '#ff4d4f' }}>
                  ¥{totalOutstanding.toFixed(2)}
                </strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} />
            </Table.Summary.Row>
          );
        }}
      />

      <Modal
        title={`客户明细: ${detailCustomer?.customerName || ''}`}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={960}
      >
        {detailCustomer && (
          <Descriptions
            size="small"
            bordered
            column={3}
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label="订单总额">
              ¥{detailCustomer.totalPayAmount.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="已开票">
              ¥{detailCustomer.totalInvoiced.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="未核销余额">
              <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                ¥{detailCustomer.outstanding.toFixed(2)}
              </span>
            </Descriptions.Item>
          </Descriptions>
        )}
        <Table
          rowKey="id"
          columns={orderColumns}
          dataSource={detailOrders}
          loading={detailLoading}
          pagination={false}
          size="small"
          bordered
        />
      </Modal>
    </div>
  );
}
