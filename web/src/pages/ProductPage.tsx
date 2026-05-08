import { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, DatePicker } from 'antd';
import { fetchAllSkus, createProduct } from '@/api/products';
import { syncJushuitan } from '@/api/products';
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

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchAllSkus({ page: 1, pageSize: 100 });
      setData(res.data);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
      key: 'productName',
      width: 160,
      ellipsis: true,
      render: (_: any, record: any) => record.product?.name || '-',
    },
    {
      title: 'SKU编码',
      dataIndex: 'jstSkuId',
      key: 'jstSkuId',
      width: 120,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '规格',
      dataIndex: 'skuName',
      key: 'skuName',
      width: 140,
      ellipsis: true,
      render: (_: string, record: any) =>
        record.skuName || record.propertiesValue || '-',
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      ellipsis: true,
      render: (_: string, record: any) =>
        record.category || record.product?.category || '-',
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
      width: 100,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '销售价',
      dataIndex: 'salePrice',
      key: 'salePrice',
      width: 90,
      align: 'right' as const,
      render: (v: number) => (v != null ? `¥${v}` : '-'),
    },
    {
      title: '成本价',
      dataIndex: 'costPrice',
      key: 'costPrice',
      width: 90,
      align: 'right' as const,
      render: (v: number) => (v != null ? `¥${v}` : '-'),
    },
    {
      title: '上市时间',
      dataIndex: 'launchDate',
      key: 'launchDate',
      width: 110,
      render: (_: any, record: any) =>
        record.product?.launchDate
          ? dayjs(record.product.launchDate).format('YYYY-MM-DD')
          : '-',
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
    <div>
      <Space
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 500 }}>商品列表（按SKU）</span>
        <Space>
          <Button loading={syncing} onClick={handleSync}>
            同步聚水潭
          </Button>
          <Button type="primary" onClick={() => setOpen(true)}>
            + 新建商品
          </Button>
        </Space>
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 1070 }}
        style={{ width: '100%' }}
        rowClassName="product-sku-row"
      />
      <Modal
        title="新建商品"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="商品名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="请输入商品名称" />
          </Form.Item>
          <Form.Item label="分类" name="category">
            <Input placeholder="请输入分类" />
          </Form.Item>
          <Form.Item label="单位" name="unit">
            <Input placeholder="件/个/套..." />
          </Form.Item>
          <Form.Item label="上市时间" name="launchDate">
            <DatePicker placeholder="请选择上市时间" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="请输入商品描述" rows={3} />
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
