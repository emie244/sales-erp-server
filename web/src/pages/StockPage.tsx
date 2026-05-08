import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Input,
  Select,
  Tag,
  Space,
  Button,
  Pagination,
  Modal,
  Form,
  InputNumber,
  message,
  Card,
  Badge,
  Image,
} from 'antd';
import { useSearchParams } from 'react-router-dom';
import { SearchOutlined, SafetyOutlined, DatabaseOutlined } from '@ant-design/icons';
import { fetchStocks, fetchWarehouses, updateSafetyStock } from '@/api/stocks';
import type { StockItem } from '@/api/stocks';

const { Option } = Select;

const statusMap: Record<string, { label: string; color: string }> = {
  normal: { label: '正常', color: 'success' },
  warning: { label: '预警', color: 'warning' },
  danger: { label: '缺货', color: 'error' },
};

export default function StockPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [status, setStatus] = useState<string>(searchParams.get('status') || '');
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [form] = Form.useForm();

  const loadData = useCallback(
    async (p = page, ps = pageSize) => {
      setLoading(true);
      try {
        const res = await fetchStocks({
          page: p,
          pageSize: ps,
          keyword: keyword || undefined,
          warehouseId: warehouseId || undefined,
          status: status || undefined,
        });
        setData(res.data || []);
        setTotal(res.total || 0);
      } catch {
        message.error('加载库存数据失败');
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, keyword, warehouseId, status],
  );

  const loadWarehouses = useCallback(async () => {
    try {
      const res = await fetchWarehouses();
      setWarehouses(res || []);
    } catch {
      // ignore
    }
  }, []);

  // Sync URL params to state
  useEffect(() => {
    const urlStatus = searchParams.get('status') || '';
    if (urlStatus !== status) {
      setStatus(urlStatus);
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
    loadWarehouses();
  }, [loadData, loadWarehouses]);

  const updateUrlParams = (nextStatus: string, nextKeyword: string, nextWarehouse: string) => {
    const params: Record<string, string> = {};
    if (nextStatus) params.status = nextStatus;
    if (nextKeyword) params.keyword = nextKeyword;
    if (nextWarehouse) params.warehouseId = nextWarehouse;
    setSearchParams(Object.keys(params).length > 0 ? params : {});
  };

  const handleSearch = () => {
    setPage(1);
    updateUrlParams(status, keyword, warehouseId);
    loadData(1, pageSize);
  };

  const handleReset = () => {
    setKeyword('');
    setWarehouseId('');
    setStatus('');
    setPage(1);
    setSearchParams({});
    loadData(1, pageSize);
  };

  const openEditModal = (item: StockItem) => {
    setEditingItem(item);
    form.setFieldsValue({ safetyStock: item.safetyStock });
    setEditModalOpen(true);
  };

  const handleSaveSafetyStock = async (values: { safetyStock: number }) => {
    if (!editingItem) return;
    try {
      await updateSafetyStock(
        editingItem.skuId,
        editingItem.warehouseId,
        values.safetyStock,
      );
      message.success('安全库存更新成功');
      setEditModalOpen(false);
      loadData();
    } catch {
      message.error('更新失败');
    }
  };

  const warningCount = data.filter((d) => d.status === 'warning').length;
  const dangerCount = data.filter((d) => d.status === 'danger').length;

  const columns = [
    {
      title: 'SKU',
      key: 'sku',
      width: 240,
      ellipsis: true,
      render: (_: any, record: StockItem) => (
        <Space>
          {record.pic && (
            <Image
              src={record.pic}
              width={40}
              height={40}
              style={{ objectFit: 'cover', borderRadius: 10, flexShrink: 0 }}
              preview={false}
              fallback="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
            />
          )}
          <div>
            <div style={{ fontWeight: 500 }}>
              {record.skuName || record.skuCode || record.skuId}
            </div>
            <div style={{ fontSize: 12, color: '#A0A0A0' }}>{record.skuId}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      key: 'productName',
      width: 160,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '仓库',
      dataIndex: 'warehouseId',
      key: 'warehouseId',
      width: 120,
      ellipsis: true,
    },
    {
      title: '可用库存',
      dataIndex: 'availableQty',
      key: 'availableQty',
      width: 90,
      align: 'right' as const,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{Number(v || 0).toFixed(0)}</span>,
    },
    {
      title: '安全库存',
      dataIndex: 'safetyStock',
      key: 'safetyStock',
      width: 90,
      align: 'right' as const,
      render: (v: number) => Number(v || 0).toFixed(0),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v: string) => {
        const map = statusMap[v] || { label: v, color: 'default' };
        return <Badge status={map.color as any} text={map.label} />;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right' as const,
      render: (_: any, record: StockItem) => (
        <Button type="link" size="small" onClick={() => openEditModal(record)}>
          <SafetyOutlined /> 设置安全库存
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card size="small">
          <Space wrap>
            <Input
              placeholder="搜索 SKU/产品名/SKU编码"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              style={{ width: 260 }}
              prefix={<SearchOutlined />}
            />
            <Select
              placeholder="选择仓库"
              value={warehouseId || undefined}
              onChange={setWarehouseId}
              style={{ width: 180 }}
              allowClear
            >
              {warehouses.map((w) => (
                <Option key={w} value={w}>
                  {w}
                </Option>
              ))}
            </Select>
            <Select
              placeholder="库存状态"
              value={status || undefined}
              onChange={setStatus}
              style={{ width: 140 }}
              allowClear
            >
              <Option value="normal">正常</Option>
              <Option value="warning">预警</Option>
              <Option value="danger">缺货</Option>
            </Select>
            <Button type="primary" onClick={handleSearch}>
              查询
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>
        </Card>

        <Card size="small">
          <Space size="large">
            <span>
              <DatabaseOutlined /> 总库存项：<strong>{total}</strong>
            </span>
            <span>
              <Tag color="warning">预警</Tag> <strong>{warningCount}</strong> 项
            </span>
            <span>
              <Tag color="error">缺货</Tag> <strong>{dangerCount}</strong> 项
            </span>
          </Space>
        </Card>

        <Table
          columns={columns}
          dataSource={data}
          rowKey={(r) => `${r.skuId}-${r.warehouseId}`}
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 880 }}
          style={{ width: '100%' }}
        />

        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          showTotal={(t) => `共 ${t} 条`}
          onChange={(p, ps) => {
            setPage(p);
            setPageSize(ps);
            loadData(p, ps);
          }}
        />
      </Space>

      <Modal
        title="设置安全库存"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} onFinish={handleSaveSafetyStock} layout="vertical">
          <Form.Item label="SKU">
            <span>{editingItem?.skuName || editingItem?.skuId}</span>
          </Form.Item>
          <Form.Item label="仓库">
            <span>{editingItem?.warehouseId}</span>
          </Form.Item>
          <Form.Item
            name="safetyStock"
            label="安全库存"
            rules={[{ required: true, message: '请输入安全库存' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="当前可用库存">
            <span>{Number(editingItem?.availableQty || 0).toFixed(0)}</span>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
