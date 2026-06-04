import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Table,
  Tag,
  message,
  Descriptions,
  Divider,
  InputNumber,
  Space,
  Tabs,
  Card,
  Collapse,
  Empty,
  Statistic,
  Row,
  Col,
  Modal,
  Form,
  Input,
  Select,
  AutoComplete,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  InboxOutlined,
  UpOutlined,
  DownOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FileTextOutlined,
  BuildOutlined,
  DollarOutlined,
  BarChartOutlined,
  ShoppingCartOutlined,
  PlusOutlined,
  DeleteOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import axios from '@/api/axios';
import { updateSku, addSkuToProduct, uploadSkuImages, deleteSkuImage } from '@/api/products';
import MultiImageUpload from '@/components/MultiImageUpload';
import { fetchMaterialCategories } from '@/api/material-categories';
import { createBom } from '@/api/boms';
import type { MaterialCategory } from '@/api/material-categories';
import PageHeader from '@/components/PageHeader';

const { TabPane } = Tabs;
const { Panel } = Collapse;

interface StockSnapshot {
  skuId: string;
  warehouseId: string;
  availableQty: number;
  safetyStock: number;
  syncedAt: string;
}

interface StockLedgerItem {
  id: string;
  skuId: string;
  type: 'inbound' | 'outbound';
  qty: number;
  referenceType: string;
  referenceId: string;
  remark: string;
  createdAt: string;
}

interface BomItem {
  id: string;
  materialSkuId: string;
  qty: number;
  lossRate: number;
  materialCategoryName?: string;
  remark?: string;
}

interface BomData {
  id: string;
  skuId: string;
  version: string;
  isActive: boolean;
  remark?: string;
  items: BomItem[];
  skuName?: string;
  skuCode?: string;
}

interface PricePolicy {
  id: string;
  skuId: string;
  customerLevel: string;
  price: number;
  minQty: number;
}

interface SalesStats {
  summary: {
    totalQty: number;
    totalAmount: number;
    orderCount: number;
  };
  daily: Array<{
    date: string;
    qty: number;
    amount: number;
  }>;
}

interface RelatedOrder {
  id: string;
  orderNo: string;
  status: string;
  customerName: string;
  createdAt: string;
  items: Array<{
    skuId: string;
    skuName: string;
    qty: number;
    unitPrice: number;
    lineAmount: number;
  }>;
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [skus, setSkus] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingSkuId, setSavingSkuId] = useState<string | null>(null);
  const isAdmin = localStorage.getItem('erp_role') === 'admin';

  // 添加 SKU
  const [addSkuModalOpen, setAddSkuModalOpen] = useState(false);
  const [addSkuForm] = Form.useForm();
  const [addingSku, setAddingSku] = useState(false);
  const [materialCategories, setMaterialCategories] = useState<MaterialCategory[]>([]);

  // 添加 BOM
  const [addBomModalOpen, setAddBomModalOpen] = useState(false);
  const [addBomForm] = Form.useForm();
  const [addingBom, setAddingBom] = useState(false);
  const [bomSkuId, setBomSkuId] = useState<string | null>(null);
  const [bomMaterialIds, setBomMaterialIds] = useState<{ id: string; name: string }[]>([]);
  const [materialSkus, setMaterialSkus] = useState<{ id: string; skuCode?: string; skuName?: string; spec?: string; jstSkuId?: string; itemType?: string }[]>([]);

  // 扩展数据
  const [stockMap, setStockMap] = useState<Record<string, StockSnapshot[]>>({});
  const [ledgerMap, setLedgerMap] = useState<Record<string, StockLedgerItem[]>>({});
  const [bomMap, setBomMap] = useState<Record<string, BomData[]>>({});
  const [priceMap, setPriceMap] = useState<Record<string, PricePolicy[]>>({});
  const [salesStatsMap, setSalesStatsMap] = useState<Record<string, SalesStats>>({});
  const [orderMap, setOrderMap] = useState<Record<string, RelatedOrder[]>>({});
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  const [loadedSet, setLoadedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    loadData();
    fetchMaterialCategories()
      .then((cats) => setMaterialCategories(cats))
      .catch(() => {});
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
      const skuList = skusRes || [];
      setSkus(skuList);
      // 物料只有一个 SKU，自动展开
      if (skuList.length === 1 && productRes?.itemType !== 'finished_good') {
        const soleSku = skuList[0];
        setExpandedSku(soleSku.id);
        handleExpand(soleSku.id, soleSku.skuCode || soleSku.jstSkuId);
      }
    } catch {
      message.error('加载产品详情失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSkuExtras = async (skuId: string, skuCode: string) => {
    if (loadedSet.has(skuId)) return;
    try {
      const [stockRes, ledgerRes, bomRes, priceRes, salesRes, orderRes] = await Promise.allSettled([
        axios.get(`/stocks/${encodeURIComponent(skuCode || skuId)}`),
        axios.get(`/stocks/ledger/${encodeURIComponent(skuCode || skuId)}`),
        axios.get(`/boms/sku/${encodeURIComponent(skuCode || skuId)}`),
        axios.get(`/products/skus/${skuId}/prices`),
        axios.get(`/products/skus/${skuId}/sales-stats`),
        axios.get(`/products/skus/${skuId}/orders`),
      ]);

      if (stockRes.status === 'fulfilled') {
        setStockMap((prev) => ({ ...prev, [skuId]: (stockRes.value as any) || [] }));
      }
      if (ledgerRes.status === 'fulfilled') {
        setLedgerMap((prev) => ({ ...prev, [skuId]: (ledgerRes.value as any)?.data || [] }));
      }
      if (bomRes.status === 'fulfilled') {
        setBomMap((prev) => ({ ...prev, [skuId]: (bomRes.value as any) || [] }));
      }
      if (priceRes.status === 'fulfilled') {
        setPriceMap((prev) => ({ ...prev, [skuId]: (priceRes.value as any) || [] }));
      }
      if (salesRes.status === 'fulfilled') {
        setSalesStatsMap((prev) => ({ ...prev, [skuId]: (salesRes.value as any) || null }));
      }
      if (orderRes.status === 'fulfilled') {
        setOrderMap((prev) => ({ ...prev, [skuId]: (orderRes.value as any)?.data || [] }));
      }
    } catch {
      // silent fail
    } finally {
      setLoadedSet((prev) => new Set(prev).add(skuId));
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

  const handleExpand = (skuId: string, skuCode: string) => {
    if (expandedSku === skuId) {
      setExpandedSku(null);
    } else {
      setExpandedSku(skuId);
      loadSkuExtras(skuId, skuCode);
    }
  };

  const allPics = product?.skus?.[0]?.pics?.length
    ? product.skus[0].pics
    : product?.skus?.[0]?.localPic || product?.skus?.[0]?.pic
      ? [product.skus[0].localPic || product.skus[0].pic]
      : [];
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const mainImage = allPics[mainImageIndex] || '';

  // 库存分布列
  const stockColumns = [
    { title: '仓库', dataIndex: 'warehouseId', key: 'warehouseId' },
    {
      title: '可用库存',
      dataIndex: 'availableQty',
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#52c41a' : '#999' }}>{v}</span>
      ),
    },
    {
      title: '安全库存',
      dataIndex: 'safetyStock',
      render: (v: number) => (v > 0 ? v : '-'),
    },
  ];

  // 库存流水列
  const ledgerColumns = [
    {
      title: '类型',
      dataIndex: 'type',
      render: (v: string) =>
        v === 'inbound' ? (
          <Tag color="green" icon={<ArrowDownOutlined />}>
            入库
          </Tag>
        ) : (
          <Tag color="red" icon={<ArrowUpOutlined />}>
            出库
          </Tag>
        ),
    },
    { title: '数量', dataIndex: 'qty' },
    {
      title: '关联',
      dataIndex: 'referenceType',
      render: (_v: string, record: StockLedgerItem) => (
        <span style={{ fontSize: 12, color: '#666' }}>
          {record.remark || record.referenceType}
        </span>
      ),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      render: (v: string) =>
        v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
  ];

  // BOM 子物料列
  const bomItemColumns = [
    {
      title: '子物料编码',
      dataIndex: 'materialSkuId',
      key: 'materialSkuId',
      render: (v: string) => {
        const matched = skus.find((s) => s.skuCode === v || s.jstSkuId === v);
        return (
          <span>
            {v}
            {matched?.skuName && (
              <span style={{ color: '#666', marginLeft: 8 }}>({matched.skuName})</span>
            )}
          </span>
        );
      },
    },
    {
      title: '数量',
      dataIndex: 'qty',
      render: (v: number, record: BomItem) => (
        <span>
          {v}
          {record.lossRate > 0 && (
            <span style={{ color: '#999', fontSize: 12 }}>
              {' '}
              (损耗{record.lossRate}%)
            </span>
          )}
        </span>
      ),
    },
    {
      title: '物料分类',
      dataIndex: 'materialCategoryName',
      render: (v: string) => v || '-',
    },
  ];

  // 价格策略列
  const priceColumns = [
    { title: '客户级别', dataIndex: 'customerLevel', key: 'customerLevel' },
    {
      title: '价格',
      dataIndex: 'price',
      render: (v: number) => (v != null ? <span style={{ color: '#1890ff' }}>¥{v}</span> : '-'),
    },
    {
      title: '最小起订量',
      dataIndex: 'minQty',
      render: (v: number) => (v > 0 ? v : '-'),
    },
  ];

  // 关联订单列
  const orderColumns = [
    { title: '订单号', dataIndex: 'orderNo', key: 'orderNo' },
    {
      title: '客户',
      dataIndex: 'customerName',
      render: (_v: string, record: RelatedOrder) => record.customerName || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string) => {
        const statusMap: Record<string, string> = {
          draft: '草稿',
          pending_approval: '待审批',
          approved: '已审批',
          rejected: '已驳回',
          processing: '处理中',
          ready_to_ship: '待发货',
          synced_jst: '已同步',
          shipped: '已发货',
          completed: '已完成',
          cancelled: '已取消',
        };
        return <Tag>{statusMap[v] || v}</Tag>;
      },
    },
    {
      title: '本SKU数量',
      key: 'skuQty',
      render: (_v: string, record: RelatedOrder) =>
        record.items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    },
    {
      title: '本SKU金额',
      key: 'skuAmount',
      render: (_v: string, record: RelatedOrder) =>
        `¥${record.items.reduce((sum, item) => sum + Number(item.lineAmount || 0), 0).toFixed(2)}`,
    },
    {
      title: '下单时间',
      dataIndex: 'createdAt',
      render: (v: string) => (v ? new Date(v).toLocaleString('zh-CN') : '-'),
    },
  ];

  const isMaterial = product?.itemType ? product.itemType !== 'finished_good' : false;
  const skuColumns = [
    {
      title: isMaterial ? '物料图片' : 'SKU 图片',
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
    { title: isMaterial ? '物料名称' : '规格名称', dataIndex: 'skuName', key: 'skuName', width: 120 },
    { title: isMaterial ? '物料编码' : 'SKU 编码', dataIndex: 'skuCode', key: 'skuCode', width: 140 },
    { title: '聚水潭 ID', dataIndex: 'jstSkuId', key: 'jstSkuId', width: 140 },
    {
      title: '售价',
      dataIndex: 'salePrice',
      width: 80,
      render: (v: number) => (v != null ? `¥${v}` : '-'),
    },
    {
      title: '成本',
      dataIndex: 'costPrice',
      width: 80,
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
      width: 80,
      render: (v: boolean) =>
        v ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>,
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={expandedSku === record.id ? <UpOutlined /> : <DownOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              handleExpand(record.id, record.skuCode || record.jstSkuId);
            }}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              Modal.confirm({
                title: '确认删除 SKU',
                content: `确定删除 SKU「${record.skuName || record.skuCode}」吗？`,
                onOk: async () => {
                  try {
                    await axios.delete(`/products/skus/${record.id}`);
                    message.success('SKU 删除成功');
                    loadData();
                  } catch (err: any) {
                    message.error(err?.response?.data?.message || '删除失败');
                  }
                },
              });
            }}
          />
        </Space>
      ),
    },
  ];

  const expandedRowRender = (record: any) => {
    const skuId = record.id;
    const stocks = stockMap[skuId] || [];
    const ledgers = ledgerMap[skuId] || [];
    const boms = bomMap[skuId] || [];
    const prices = priceMap[skuId] || [];
    const salesStats = salesStatsMap[skuId];
    const orders = orderMap[skuId] || [];

    return (
      <Card
        size="small"
        style={{ margin: '8px 0 8px 40px', background: '#fafafa' }}
        loading={expandedSku === skuId && !loadedSet.has(skuId)}
      >
        <Tabs size="small" defaultActiveKey="stock">
          <TabPane
            tab={
              <span>
                <InboxOutlined /> 库存分布 ({stocks.length})
              </span>
            }
            key="stock"
          >
            {stocks.length > 0 ? (
              <Table
                size="small"
                columns={stockColumns}
                dataSource={stocks}
                pagination={false}
                rowKey={(r: any) => `${r.skuId}-${r.warehouseId}`}
              />
            ) : (
              <Empty description="暂无库存数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </TabPane>

          <TabPane
            tab={
              <span>
                <FileTextOutlined /> 库存流水 ({ledgers.length})
              </span>
            }
            key="ledger"
          >
            {ledgers.length > 0 ? (
              <Table
                size="small"
                columns={ledgerColumns}
                dataSource={ledgers}
                pagination={false}
                rowKey="id"
              />
            ) : (
              <Empty description="暂无流水记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </TabPane>

          {product?.itemType === 'finished_good' && (
          <TabPane
            tab={
              <span>
                <BuildOutlined /> BOM 结构 ({boms.length})
              </span>
            }
            key="bom"
          >
            <div style={{ marginBottom: 12, textAlign: 'right' }}>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={async () => {
                  setBomSkuId(skuId);
                  // 加载系统物料（非成品）和历史 BOM 子物料编码
                  try {
                    const [skuRes, materialRes] = await Promise.all([
                      axios.get('/products/all-skus?pageSize=1000&itemTypes=semi_finished,raw_material,packaging'),
                      axios.get('/boms/material-sku-ids'),
                    ]);
                    setMaterialSkus((skuRes as any)?.data || []);
                    setBomMaterialIds((materialRes as any) || []);
                  } catch {
                    setMaterialSkus([]);
                    setBomMaterialIds([]);
                  }
                  addBomForm.resetFields();
                  addBomForm.setFieldsValue({ version: 'v1', items: [{}] });
                  setAddBomModalOpen(true);
                }}
              >
                添加 BOM
              </Button>
            </div>
            {boms.length > 0 ? (
              <Collapse ghost size="small">
                {boms.map((bom: BomData) => (
                  <Panel
                    header={`${bom.skuCode || bom.skuId} (版本: ${bom.version}, ${bom.isActive ? '启用' : '停用'})`}
                    key={bom.id}
                  >
                    <Table
                      size="small"
                      columns={bomItemColumns}
                      dataSource={bom.items}
                      pagination={false}
                      rowKey="id"
                    />
                  </Panel>
                ))}
              </Collapse>
            ) : (
              <Empty description="暂无 BOM 数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </TabPane>
          )}

          {product?.itemType === 'finished_good' && (
          <TabPane
            tab={
              <span>
                <DollarOutlined /> 价格策略 ({prices.length})
              </span>
            }
            key="price"
          >
            {prices.length > 0 ? (
              <Table
                size="small"
                columns={priceColumns}
                dataSource={prices}
                pagination={false}
                rowKey="id"
              />
            ) : (
              <Empty description="暂无价格策略" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </TabPane>
          )}

          {product?.itemType === 'finished_good' && (
          <TabPane
            tab={
              <span>
                <BarChartOutlined /> 销售统计
              </span>
            }
            key="sales"
          >
            {salesStats ? (
              <div>
                <Row gutter={16} style={{ marginBottom: 12 }}>
                  <Col span={8}>
                    <Statistic
                      title="近30天销量"
                      value={salesStats.summary.totalQty}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="近30天销售额"
                      value={salesStats.summary.totalAmount.toFixed(2)}
                      prefix="¥"
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="涉及订单数"
                      value={salesStats.summary.orderCount}
                      valueStyle={{ color: '#fa8c16' }}
                    />
                  </Col>
                </Row>
                {salesStats.daily.length > 0 ? (
                  <Table
                    size="small"
                    columns={[
                      { title: '日期', dataIndex: 'date', render: (v: string) => v ? new Date(v).toLocaleDateString('zh-CN') : '-' },
                      { title: '销量', dataIndex: 'qty' },
                      { title: '销售额', dataIndex: 'amount', render: (v: number) => `¥${(v || 0).toFixed(2)}` },
                    ]}
                    dataSource={salesStats.daily}
                    pagination={{ pageSize: 7, size: 'small' }}
                    rowKey="date"
                  />
                ) : (
                  <Empty description="暂无每日明细" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </div>
            ) : (
              <Empty description="暂无销售数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </TabPane>
          )}

          {product?.itemType === 'finished_good' && (
          <TabPane
            tab={
              <span>
                <ShoppingCartOutlined /> 关联订单 ({orders.length})
              </span>
            }
            key="orders"
          >
            {orders.length > 0 ? (
              <Table
                size="small"
                columns={orderColumns}
                dataSource={orders}
                pagination={{ pageSize: 5, size: 'small' }}
                rowKey="id"
                onRow={(record: RelatedOrder) => ({
                  onClick: () => navigate(`/sales-orders/${record.id}`),
                  style: { cursor: 'pointer' },
                })}
              />
            ) : (
              <Empty description="暂无关联订单" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </TabPane>
          )}

          <TabPane
            tab={
              <span>
                <PictureOutlined /> 图片管理
              </span>
            }
            key="images"
          >
            <MultiImageUpload
              value={record.pics || (record.pic ? [record.pic] : [])}
              onChange={(urls) => {
                // 本地乐观更新
                setSkus((prev) =>
                  prev.map((s) =>
                    s.id === skuId ? { ...s, pics: urls, pic: urls[0] || null } : s,
                  ),
                );
              }}
              onUpload={async (files) => {
                const newUrls = await uploadSkuImages(skuId, files);
                return newUrls;
              }}
              onDelete={async (index) => {
                await deleteSkuImage(skuId, index);
              }}
            />
          </TabPane>
        </Tabs>
      </Card>
    );
  };

  // 统计
  const totalStock = skus.reduce(
    (sum, s) => sum + (s.localStockQty || 0),
    0,
  );

  return (
    <div>
      <PageHeader
        title={product?.itemType === 'finished_good' ? '产品详情' : '物料详情'}
        left={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回列表
          </Button>
        }
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6} md={5} lg={4}>
          <div
            style={{
              width: '100%',
              maxHeight: 180,
              aspectRatio: '1/1',
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid #e8e8e8',
              background: '#fafafa',
              position: 'relative',
            }}
          >
            {mainImage ? (
              <img
                referrerPolicy="no-referrer"
                src={mainImage}
                alt={product?.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#999',
                  fontSize: 12,
                }}
              >
                <PictureOutlined style={{ fontSize: 24, marginBottom: 4 }} />
                暂无图片
              </div>
            )}
          </div>
          {allPics.length > 1 && (
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginTop: 8,
                overflowX: 'auto',
              }}
            >
              {allPics.map((url: string, idx: number) => (
                <div
                  key={idx}
                  onClick={() => setMainImageIndex(idx)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 6,
                    overflow: 'hidden',
                    border: idx === mainImageIndex ? '2px solid #1890ff' : '1px solid #e8e8e8',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <img
                    referrerPolicy="no-referrer"
                    src={url}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </Col>

        <Col xs={24} sm={18} md={19} lg={20}>
          <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
            {product?.name || '加载中...'}
            {product?.isActive ? (
              <Tag color="green" style={{ marginLeft: 8 }}>启用</Tag>
            ) : (
              <Tag style={{ marginLeft: 8 }}>禁用</Tag>
            )}
          </div>

          <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3, lg: 4 }}>
            <Descriptions.Item label={isMaterial ? '物料编码' : 'SPU 编码'}>
              {product?.spuCode || '--'}
            </Descriptions.Item>
            <Descriptions.Item label="分类">
              {product?.category || '--'}
            </Descriptions.Item>
            <Descriptions.Item label="品牌">
              {product?.skus?.[0]?.brand || '--'}
            </Descriptions.Item>
            <Descriptions.Item label="生命周期">
              {product?.lifecycleStage || '--'}
            </Descriptions.Item>
            <Descriptions.Item label="聚水潭 ID">
              {product?.jstGoodsId || '--'}
            </Descriptions.Item>
            <Descriptions.Item label={isMaterial ? '物料数量' : 'SKU 数量'}>
              <span style={{ color: '#1890ff', fontWeight: 600 }}>{skus.length}</span>
            </Descriptions.Item>
            <Descriptions.Item label="本地总库存">
              <span style={{ color: totalStock > 0 ? '#52c41a' : '#999', fontWeight: 600 }}>
                {totalStock}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="上市日期">
              {product?.launchDate
                ? new Date(product.launchDate).toLocaleDateString('zh-CN')
                : '--'}
            </Descriptions.Item>
          </Descriptions>

          {product?.description && (
            <div style={{ marginTop: 8 }}>
              <span style={{ color: '#666', fontSize: 13 }}>描述：</span>
              <span style={{ color: '#333', fontSize: 13 }}>
                {product.description}
              </span>
            </div>
          )}
        </Col>
      </Row>

      <Divider />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title={isMaterial ? '物料数量' : 'SKU 数量'}
              value={skus.length}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="本地总库存"
              value={totalStock}
              valueStyle={{ color: totalStock > 0 ? '#52c41a' : '#999' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="平均售价"
              value={
                skus.length > 0
                  ? (
                      skus.reduce((s, x) => s + (x.salePrice || 0), 0) /
                      skus.length
                    ).toFixed(2)
                  : 0
              }
              prefix="¥"
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="平均成本"
              value={
                skus.length > 0
                  ? (
                      skus.reduce((s, x) => s + (x.costPrice || 0), 0) /
                      skus.length
                    ).toFixed(2)
                  : 0
              }
              prefix="¥"
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={product?.itemType === 'finished_good' ? 'SKU 列表' : '物料信息'}
        style={{ marginTop: 16 }}
        extra={
          product?.itemType === 'finished_good' && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                addSkuForm.resetFields();
                setAddSkuModalOpen(true);
              }}
            >
              添加 SKU
            </Button>
          )
        }
      >
        <Table
          rowKey="id"
          columns={skuColumns}
          dataSource={skus}
          loading={loading}
          pagination={false}
          size="middle"
          scroll={{ x: 'max-content' }}
          expandable={{
            expandedRowRender,
            expandedRowKeys: expandedSku ? [expandedSku] : [],
            expandIconColumnIndex: -1,
          }}
          onRow={(record: any) => ({
            onClick: () => handleExpand(record.id, record.skuCode || record.jstSkuId),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      {/* 添加 SKU 弹窗 */}
      <Modal
        title="添加 SKU"
        open={addSkuModalOpen}
        onCancel={() => setAddSkuModalOpen(false)}
        onOk={() => addSkuForm.submit()}
        confirmLoading={addingSku}
        destroyOnClose
      >
        <Form
          form={addSkuForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!id) return;
            setAddingSku(true);
            try {
              await addSkuToProduct(id, {
                skuName: values.skuName,
                spec: values.spec,
                salePrice: values.salePrice,
                costPrice: values.costPrice,
                weight: values.weight,
                pics: values.pics || [],
                pic: values.pics?.[0],
                itemType: values.itemType || 'finished_good',
                materialCategoryId: values.materialCategoryId,
              });
              message.success('SKU 添加成功');
              setAddSkuModalOpen(false);
              addSkuForm.resetFields();
              loadData();
            } catch (e: any) {
              message.error(e?.response?.data?.message || e?.message || '添加失败');
            } finally {
              setAddingSku(false);
            }
          }}
        >
          <Form.Item label="SKU 规格名称" name="skuName" rules={[{ required: true }]}>
            <Input placeholder="如：黑色 10000mAh" />
          </Form.Item>
          <Form.Item label="规格" name="spec">
            <Input placeholder="如：10000mAh / 黑色" />
          </Form.Item>
          <Form.Item label="物料类型" name="itemType">
            <Select
              placeholder="请选择"
              defaultValue="finished_good"
              options={[
                { label: '成品', value: 'finished_good' },
                { label: '半成品', value: 'semi_finished' },
                { label: '原材料', value: 'raw_material' },
                { label: '包材', value: 'packaging' },
              ]}
            />
          </Form.Item>
          <Space>
            <Form.Item label="销售价" name="salePrice">
              <InputNumber placeholder="¥" min={0} precision={2} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item label="成本价" name="costPrice">
              <InputNumber placeholder="¥" min={0} precision={2} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item label="重量(kg)" name="weight">
              <InputNumber placeholder="kg" min={0} precision={3} style={{ width: 140 }} />
            </Form.Item>
          </Space>
          <Form.Item label="物料分类" name="materialCategoryId">
            <Select
              placeholder="请选择物料分类（选填）"
              allowClear
              showSearch
              options={materialCategories.map((c) => ({
                label: c.name,
                value: c.id,
              }))}
            />
          </Form.Item>
          <Form.Item label="图片" name="pics" initialValue={[]} style={{ marginTop: 16 }}>
            <MultiImageUpload
              maxCount={9}
              onUpload={async (files) => {
                // 添加 SKU 时 product ID 已知但 SKU 尚未创建
                // 使用本地预览 URL，创建后再上传到服务器
                const urls = files.map((f) => URL.createObjectURL(f));
                const current = addSkuForm.getFieldValue('pics') || [];
                addSkuForm.setFieldsValue({ pics: [...current, ...urls] });
                return [...current, ...urls];
              }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加 BOM 弹窗 */}
      <Modal
        title="添加 BOM"
        open={addBomModalOpen}
        onCancel={() => setAddBomModalOpen(false)}
        onOk={() => addBomForm.submit()}
        confirmLoading={addingBom}
        destroyOnClose
        width={720}
      >
        <Form
          form={addBomForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!id || !bomSkuId) return;
            setAddingBom(true);
            try {
              await createBom({
                productId: product?.jstGoodsId || id,
                skuId: bomSkuId,
                version: values.version || 'v1',
                remark: values.remark,
                items: (values.items || [])
                  .filter((it: any) => it.materialSkuId && it.qty > 0)
                  .map((it: any) => ({
                    materialSkuId: it.materialSkuId,
                    qty: Number(it.qty),
                    lossRate: it.lossRate ? Number(it.lossRate) : undefined,
                    remark: it.remark,
                  })),
              });
              message.success('BOM 添加成功');
              setAddBomModalOpen(false);
              addBomForm.resetFields();
              // 刷新 BOM 数据
              const sku = skus.find((s) => s.id === bomSkuId);
              if (sku) {
                const bomRes = await axios.get(`/boms/sku/${encodeURIComponent(sku.skuCode || sku.id)}`);
                setBomMap((prev) => ({ ...prev, [bomSkuId]: (bomRes as any) || [] }));
              }
            } catch (e: any) {
              message.error(e?.response?.data?.message || e?.message || '添加失败');
            } finally {
              setAddingBom(false);
            }
          }}
        >
          <Form.Item label="版本号" name="version" initialValue="v1">
            <Input placeholder="如：v1" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={12} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={14}>
                      <Form.Item
                        {...restField}
                        name={[name, 'materialSkuId']}
                        rules={[{ required: true, message: '请选择或输入子物料编码' }]}
                        noStyle
                      >
                        <AutoComplete
                          placeholder="选择或输入子物料编码"
                          allowClear
                          style={{ width: '100%' }}
                          dropdownStyle={{ minWidth: 400 }}
                          options={[
                            // 系统物料（非成品）
                            ...materialSkus.map((s) => ({
                              label: `${s.skuCode || s.jstSkuId || s.id} ${s.skuName || ''} ${s.spec || ''} [${s.itemType === 'raw_material' ? '原材料' : s.itemType === 'semi_finished' ? '半成品' : s.itemType === 'packaging' ? '包材' : '物料'}]`,
                              value: s.skuCode || s.jstSkuId || s.id,
                            })),
                            // 历史 BOM 编码（去重）
                            ...bomMaterialIds
                              .filter((m) => !materialSkus.some((s) => s.skuCode === m.id || s.jstSkuId === m.id))
                              .map((m) => ({
                                label: `${m.id} ${m.name || ''} [历史编码]`,
                                value: m.id,
                              })),
                          ]}
                          filterOption={(inputValue, option) =>
                            (option?.label ?? '')
                              .toLowerCase()
                              .includes(inputValue.toLowerCase())
                          }
                        />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item
                        {...restField}
                        name={[name, 'qty']}
                        rules={[{ required: true, message: '用量' }]}
                        noStyle
                      >
                        <InputNumber placeholder="用量" min={0.0001} precision={4} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item
                        {...restField}
                        name={[name, 'lossRate']}
                        noStyle
                      >
                        <InputNumber placeholder="损耗率%" min={0} max={100} precision={2} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Button type="link" danger onClick={() => remove(name)}>
                        删除
                      </Button>
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  添加子物料
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
