import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Table, Tag, message, Descriptions, Divider } from 'antd';
import { ArrowLeftOutlined, EyeOutlined } from '@ant-design/icons';
import axios from '@/api/axios';
import PageHeader from '@/components/PageHeader';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [skus, setSkus] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productRes, skusRes] = await Promise.all([
        axios.get(`/products/${id}`),
        axios.get(`/products/skus`, { params: { productId: id } }),
      ]);
      setProduct(productRes.data.data);
      setSkus(skusRes.data.data || []);
    } catch {
      message.error('加载产品详情失败');
    } finally {
      setLoading(false);
    }
  };

  const productImg =
    product?.skus?.[0]?.localPic || product?.skus?.[0]?.pic || '';

  const skuColumns = [
    {
      title: 'SKU 图片',
      dataIndex: 'pic',
      width: 80,
      render: (_: any, record: any) => (
        <img
          src={
            record.localPic ||
            record.pic ||
            'https://placehold.co/60x60?text=No+Image'
          }
          alt=""
          style={{
            width: 60,
            height: 60,
            objectFit: 'cover',
            borderRadius: 6,
            border: '1px solid #f0f0f0',
          }}
        />
      ),
    },
    { title: '规格名称', dataIndex: 'skuName', key: 'skuName' },
    { title: 'SKU 编码', dataIndex: 'skuCode', key: 'skuCode' },
    { title: '聚水潭 ID', dataIndex: 'jstSkuId', key: 'jstSkuId' },
    {
      title: '售价',
      dataIndex: 'salePrice',
      render: (v: number) => (v != null ? `¥${v}` : '-'),
    },
    {
      title: '成本',
      dataIndex: 'costPrice',
      render: (v: number) => (v != null ? `¥${v}` : '-'),
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      render: (v: boolean) =>
        v ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() =>
            navigate(`/boms?skuId=${record.jstSkuId || record.skuCode}`)
          }
        >
          查看 BOM
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="产品详情">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/products')}
        >
          返回列表
        </Button>
      </PageHeader>

      <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        <div
          style={{
            width: 200,
            height: 200,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid #e8e8e8',
            flexShrink: 0,
            background: '#fafafa',
          }}
        >
          {productImg ? (
            <img
              src={productImg}
              alt={product?.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: 14,
              }}
            >
              暂无图片
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 12 }}>
            {product?.name || '加载中...'}
          </div>
          <Descriptions size="small" column={4}>
            <Descriptions.Item label="分类">
              {product?.category || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="品牌">
              {product?.skus?.[0]?.brand || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="生命周期">
              {product?.lifecycleStage || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="聚水潭 ID">
              {product?.jstGoodsId || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="SKU 数量">
              {skus.length}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {product?.isActive ? (
                <Tag color="green">启用</Tag>
              ) : (
                <Tag>禁用</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="上市日期">
              {product?.launchDate
                ? new Date(product.launchDate).toLocaleDateString('zh-CN')
                : '-'}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </div>

      <Divider>SKU 列表</Divider>
      <Table
        rowKey="id"
        columns={skuColumns}
        dataSource={skus}
        loading={loading}
        pagination={false}
        size="middle"
      />
    </div>
  );
}
