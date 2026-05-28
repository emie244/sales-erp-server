import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  DatePicker,
  Select,
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { fetchProducts, createProduct } from '@/api/products';
import { syncJushuitan } from '@/api/products';
import PageHeader from '@/components/PageHeader';
import dayjs from 'dayjs';

const ProductImage = ({ src }: { src?: string }) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );
  const url = src?.trim();
  const isValid = url && url.startsWith('http');

  const containerStyle: React.CSSProperties = {
    width: 50,
    height: 50,
    background: '#F0E6FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  };

  if (!isValid) {
    return (
      <div style={containerStyle}>
        <span style={{ color: '#A0A0A0', fontSize: 10 }}>无图</span>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {status !== 'loaded' && (
        <span style={{ color: '#A0A0A0', fontSize: 10 }}>
          {status === 'loading' ? '...' : '无图'}
        </span>
      )}
      <img
        referrerPolicy="no-referrer"
        src={url}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: status === 'loaded' ? 'block' : 'none',
        }}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </div>
  );
};

export default function ProductPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [keyword, setKeyword] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const loadData = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const res = await fetchProducts({
        page,
        pageSize,
        keyword: keyword || undefined,
        sortField,
        sortOrder,
      });
      setData(res.data);
      setPagination({
        current: res.page,
        pageSize: res.pageSize,
        total: res.total,
      });
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, sortField, sortOrder]);

  const handleSubmit = async (values: any) => {
    try {
      await createProduct(values);
      message.success('创建成功');
      setOpen(false);
      form.resetFields();
      loadData();
    } catch {
      message.error('创建失败');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncJushuitan();
      message.success('同步任务已启动，请稍后刷新');
    } catch {
      message.error('同步任务启动失败');
    } finally {
      setSyncing(false);
    }
  };

  const handleTableChange = (newPagination: any) => {
    loadData(newPagination.current, newPagination.pageSize);
  };

  const columns = [
    {
      title: '商品图片',
      dataIndex: 'pic',
      key: 'pic',
      width: 80,
      render: (pic: string) => <ProductImage src={pic} />,
    },
    {
      title: '商品名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      ellipsis: true,
    },
    {
      title: 'SKU编码',
      dataIndex: 'jstGoodsId',
      key: 'jstGoodsId',
      width: 120,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '上市时间',
      dataIndex: 'launchDate',
      key: 'launchDate',
      width: 110,
      render: (v: string) =>
        v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (v: boolean) => (v ? '启用' : '禁用'),
    },
  ];

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="产品列表">
        <Space>
          <Input.Search
            placeholder="搜索名称/描述/分类"
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={() => loadData(1)}
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
              { label: '名称 ↓', value: 'name-DESC' },
              { label: '名称 ↑', value: 'name-ASC' },
            ]}
          />
          <Button loading={syncing} onClick={handleSync}>
            同步聚水潭
          </Button>
          <Button type="primary" onClick={() => setOpen(true)}>
            + 新建产品
          </Button>
        </Space>
      </PageHeader>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        sticky
        scroll={{ x: 1070 }}
        style={{ width: '100%' }}
        rowClassName="product-sku-row"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        onChange={handleTableChange}
      />
      <Modal
        title="新建产品"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="产品名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="请输入产品名称" />
          </Form.Item>
          <Form.Item label="分类" name="category">
            <Input placeholder="请输入分类" />
          </Form.Item>
          <Form.Item label="单位" name="unit">
            <Input placeholder="件/个/套..." />
          </Form.Item>
          <Form.Item label="上市时间" name="launchDate">
            <DatePicker
              placeholder="请选择上市时间"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="请输入产品描述" rows={3} />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
