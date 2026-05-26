import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Table, Tag, message, Descriptions, Divider, InputNumber, Space } from 'antd';
import { ArrowLeftOutlined, EyeOutlined, SaveOutlined } from '@ant-design/icons';
import axios from '@/api/axios';
import { updateSku } from '@/api/products';
import PageHeader from '@/components/PageHeader';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [skus, setSkus] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingSkuId, setSavingSkuId] = useState<string | null>(null);
  const isAdmin = localStorage.getItem('erp_role') === 'admin';

  useEffect(() => {
    if (!id) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productRes, skusRes] = await Promise.all([
        axios.get(`/products/${id}`) as Promise<any>,
        axios.get(`/products/skus`, {
          params: { productId: id },
        }) as Promise<any>,
      ]);
      setProduct(productRes);
      setSkus(skusRes || []);
    } catch {
      message.error('加载产品详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFloorPriceChange = (skuId: string, value: number | null) => {
    setSkus((prev) =>
      prev.map((s) => (s.id === skuId ? { ...s, floorPrice: value } : s)),
    );
  };

  const handleSaveFloorPrice = async (sku: any) => {
    setSavingSkuId(sku.id);
    try {
      await updateSku(sku.id, { floorPrice: sku.floorPrice });
      message.success('底价保存成功');
    } catch {
      message.error('底价保存失败');
      loadData();
    } finally {
      setSavingSkuId(null);
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
          referrerPolicy="no-referrer"
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
      title: '本地库存',
      dataIndex: 'localStockQty',
      width: 90,
      render: (v: number) =>
        v != null && v > 0 ? (
          <span style={{ color: '#52c41a' }}>{v}</span>
        ) : (
          <span style={{ color: '#999' }}>0</span>
        ),
    },
    {
      title: '底价',
      dataIndex: 'floorPrice',
      width: 180,
      render: (_: number, record: any) => {
        if (isAdmin) {
          return (
            <Space size="small">
              <InputNumber
                value={record.floorPrice}
                min={0}
                precision={2}
                prefix="¥"
                style={{ width: 100 }}
                placeholder="未设置"
                onChange={(v) => handleFloorPriceChange(record.id, v)}
              />
              <Button
                type="link"
                size="small"
                icon={<SaveOutlined />}
                loading={savingSkuId === record.id}
                onClick={() => handleSaveFloorPrice(record)}
              />
            </Space>
          );
        }
        return record.floorPrice != null ? (
          <span style={{ color: '#ff4d4f' }}>¥{record.floorPrice}</span>
        ) : (
          <span style={{ color: '#999' }}>-</span>
        );
      },
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
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
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
              referrerPolicy="no-referrer"
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
