import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  message,
  Card,
  Badge,
  Tabs,
  Tag,
  Pagination,
  Tooltip,
  Empty,
  Drawer,
  Select,
} from 'antd';
import { useSearchParams } from 'react-router-dom';
import {
  SearchOutlined,
  SafetyOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  SyncOutlined,
  DatabaseOutlined,
  ExceptionOutlined,
} from '@ant-design/icons';
import axios from '@/api/axios';
import { fetchAllSkus, createProduct, updateProduct, syncJushuitan } from '@/api/products';
import { createBom, updateBom, deleteBom, type BomItem, type BomHeader } from '@/api/boms';
import type { ProductSku, ProductLifecycleStage } from '@/types';
import dayjs from 'dayjs';

interface StockDetail {
  skuId: string;
  warehouseId: string;
  availableQty: number;
  safetyStock: number;
  status: 'normal' | 'warning' | 'danger';
}

interface SkuRow extends ProductSku {
  product?: {
    name: string;
    category?: string;
    launchDate?: string;
    lifecycleStage?: ProductLifecycleStage | null;
    inferredLifecycleStage?: ProductLifecycleStage;
  };
  totalAvailableQty?: number;
  stockStatus?: 'normal' | 'warning' | 'danger';
  bomVersion?: string | null;
}

const lifecycleStageMap: Record<ProductLifecycleStage, { label: string; color: string }> = {
  concept: { label: '概念/研发', color: 'default' },
  launching: { label: '即将上市', color: 'processing' },
  new: { label: '新品', color: 'success' },
  growth: { label: '成长期', color: 'cyan' },
  mature: { label: '成熟期', color: 'blue' },
  decline: { label: '衰退期', color: 'warning' },
  discontinued: { label: '已退市', color: 'error' },
};

const ProductImage = ({ src }: { src?: string }) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const url = src?.trim();
  const isValid = url && url.startsWith('http');

  if (!isValid) {
    return (
      <div style={{ width: 40, height: 40, background: '#F0E6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}>
        <span style={{ color: '#A0A0A0', fontSize: 10 }}>无图</span>
      </div>
    );
  }

  return (
    <div style={{ width: 40, height: 40, overflow: 'hidden', borderRadius: 10 }}>
      {status !== 'loaded' && (
        <div style={{ width: 40, height: 40, background: '#F0E6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#A0A0A0', fontSize: 10 }}>{status === 'loading' ? '...' : '无图'}</span>
        </div>
      )}
      <img
        src={url}
        alt=""
        style={{ width: 40, height: 40, objectFit: 'cover', display: status === 'loaded' ? 'block' : 'none' }}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </div>
  );
};

export default function ProductInventoryPage() {
  const [searchParams] = useSearchParams();
  const [skuData, setSkuData] = useState<SkuRow[]>([]);
  const [skuTotal, setSkuTotal] = useState(0);
  const [skuPage, setSkuPage] = useState(1);
  const [skuPageSize, setSkuPageSize] = useState(20);
  const [skuLoading, setSkuLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>(searchParams.get('status') || '');
  const [syncing, setSyncing] = useState(false);

  const [stockCache, setStockCache] = useState<Record<string, StockDetail[]>>({});
  const [bomCache, setBomCache] = useState<Record<string, BomHeader | null>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<SkuRow | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  const [bomModalOpen, setBomModalOpen] = useState(false);
  const [editingBom, setEditingBom] = useState<BomHeader | null>(null);
  const [bomSkuId, setBomSkuId] = useState('');
  const [bomProductId, setBomProductId] = useState('');
  const [bomFormItems, setBomFormItems] = useState<BomItem[]>([]);
  const [bomForm] = Form.useForm();

  const [safetyModalOpen, setSafetyModalOpen] = useState(false);
  const [safetySkuId, setSafetySkuId] = useState('');
  const [safetyForm] = Form.useForm();

  const [lifecycleModalOpen, setLifecycleModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState('');
  const [lifecycleForm] = Form.useForm();

  const loadSkus = useCallback(async () => {
    setSkuLoading(true);
    try {
      const res = await fetchAllSkus({ page: skuPage, pageSize: skuPageSize, keyword: keyword || undefined, status: status || undefined });
      setSkuData(res.data || []);
      setSkuTotal(res.total || 0);
    } catch {
      message.error('加载商品数据失败');
    } finally {
      setSkuLoading(false);
    }
  }, [skuPage, skuPageSize, keyword, status]);

  useEffect(() => {
    loadSkus();
  }, [loadSkus]);

  useEffect(() => {
    const urlStatus = searchParams.get('status') || '';
    if (urlStatus !== status) {
      setStatus(urlStatus);
    }
  }, [searchParams]);

  useEffect(() => {
    loadSkus();
  }, [loadSkus]);

  const loadDetail = async (skuId: string) => {
    if (stockCache[skuId] && bomCache[skuId] !== undefined) return;
    setDetailLoading((prev) => ({ ...prev, [skuId]: true }));
    try {
      const [stockRes, bomRes] = await Promise.allSettled([
        axios.get(`/stocks/${encodeURIComponent(skuId)}`),
        axios.get(`/boms/sku/${encodeURIComponent(skuId)}/active`),
      ]);

      const stockData = stockRes.status === 'fulfilled' ? (stockRes.value as any) : null;
      const bomData = bomRes.status === 'fulfilled' ? (bomRes.value as any) : null;

      if (Array.isArray(stockData)) {
        const items = stockData.map((s: any) => {
          const availableQty = Number(s.availableQty || 0);
          const safetyStock = Number(s.safetyStock || 0);
          let status: 'normal' | 'warning' | 'danger' = 'normal';
          if (safetyStock > 0 && availableQty <= 0) status = 'danger';
          else if (safetyStock > 0 && availableQty < safetyStock) status = 'warning';
          return { skuId: s.skuId, warehouseId: s.warehouseId, availableQty, safetyStock, status };
        });
        setStockCache((prev) => ({ ...prev, [skuId]: items }));
      } else {
        setStockCache((prev) => ({ ...prev, [skuId]: [] }));
      }

      if (bomData) {
        setBomCache((prev) => ({ ...prev, [skuId]: bomData as BomHeader }));
      } else {
        setBomCache((prev) => ({ ...prev, [skuId]: null }));
      }
    } catch {
      setStockCache((prev) => ({ ...prev, [skuId]: [] }));
      setBomCache((prev) => ({ ...prev, [skuId]: null }));
    } finally {
      setDetailLoading((prev) => ({ ...prev, [skuId]: false }));
    }
  };

  const openDetail = (record: SkuRow) => {
    setDetailRecord(record);
    setDetailOpen(true);
    const skuKey = record.skuCode || record.jstSkuId || '';
    if (skuKey) {
      loadDetail(skuKey);
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

  const handleCreateSubmit = async (values: any) => {
    try {
      await createProduct(values);
      message.success('创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      loadSkus();
    } catch {
      message.error('创建失败');
    }
  };

  const openBomModal = (record: SkuRow) => {
    const skuKey = record.skuCode || record.jstSkuId || '';
    const cached = skuKey ? bomCache[skuKey] : null;
    setBomSkuId(skuKey);
    setBomProductId(record.productId || '');
    if (cached) {
      setEditingBom(cached);
      setBomFormItems(cached.items || []);
      bomForm.setFieldsValue({
        version: cached.version,
        remark: cached.remark,
      });
    } else {
      setEditingBom(null);
      setBomFormItems([]);
      bomForm.resetFields();
    }
    setBomModalOpen(true);
  };

  const handleSaveBom = async (values: any) => {
    if (!bomSkuId || !bomProductId) {
      message.error('缺少 SKU 或产品信息');
      return;
    }
    const payload = {
      productId: bomProductId,
      skuId: bomSkuId,
      version: values.version || 'v1',
      remark: values.remark,
      items: bomFormItems.filter((i) => i.materialSkuId && i.qty > 0),
    };
    try {
      if (editingBom) {
        await updateBom(editingBom.id, payload);
        message.success('BOM 更新成功');
      } else {
        await createBom(payload);
        message.success('BOM 创建成功');
      }
      setBomModalOpen(false);
      if (bomSkuId) {
        setBomCache((prev) => {
          const next = { ...prev };
          delete next[bomSkuId];
          return next;
        });
      }
      loadSkus();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDeleteBom = async () => {
    if (!editingBom) return;
    Modal.confirm({
      title: '确认删除',
      content: '确定删除该 BOM 吗？',
      onOk: async () => {
        try {
          await deleteBom(editingBom.id);
          message.success('删除成功');
          setBomModalOpen(false);
          if (bomSkuId) {
            setBomCache((prev) => ({ ...prev, [bomSkuId]: null }));
          }
          loadSkus();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const openSafetyModal = async (record: SkuRow) => {
    const skuKey = record.skuCode || record.jstSkuId || '';
    if (!skuKey) {
      message.warning('SKU 信息不完整');
      return;
    }
    try {
      const res = await axios.get(`/stocks/${encodeURIComponent(skuKey)}`);
      const stocks = Array.isArray(res.data) ? res.data : [];
      if (!stocks.length) {
        message.warning('暂无库存数据');
        return;
      }
      setSafetySkuId(skuKey);
      safetyForm.setFieldsValue({
        warehouseId: stocks[0]?.warehouseId,
        safetyStock: stocks[0]?.safetyStock,
      });
      setSafetyModalOpen(true);
    } catch {
      message.error('加载库存数据失败');
    }
  };

  const handleSaveSafety = async (values: any) => {
    try {
      await axios.patch(`/stocks/${encodeURIComponent(safetySkuId)}/${encodeURIComponent(values.warehouseId)}/safety-stock`, {
        safetyStock: values.safetyStock,
      });
      message.success('安全库存更新成功');
      setSafetyModalOpen(false);
      if (safetySkuId) {
        setStockCache((prev) => {
          const next = { ...prev };
          delete next[safetySkuId];
          return next;
        });
        loadDetail(safetySkuId);
      }
    } catch {
      message.error('更新失败');
    }
  };

  const openLifecycleModal = (record: SkuRow) => {
    if (!record.productId) {
      message.warning('产品信息不完整');
      return;
    }
    setEditingProductId(record.productId);
    lifecycleForm.setFieldsValue({
      lifecycleStage: record.product?.lifecycleStage || undefined,
      launchDate: record.product?.launchDate ? dayjs(record.product.launchDate) : null,
    });
    setLifecycleModalOpen(true);
  };

  const handleSaveLifecycle = async (values: any) => {
    if (!editingProductId) return;
    try {
      await updateProduct(editingProductId, {
        lifecycleStage: values.lifecycleStage || null,
        launchDate: values.launchDate ? values.launchDate.format('YYYY-MM-DD') : null,
      });
      message.success('产品生命周期更新成功');
      setLifecycleModalOpen(false);
      loadSkus();
      if (detailOpen && detailRecord?.productId === editingProductId) {
        setDetailRecord((prev) =>
          prev
            ? {
                ...prev,
                product: {
                  ...prev.product,
                  lifecycleStage: values.lifecycleStage || null,
                  launchDate: values.launchDate ? values.launchDate.format('YYYY-MM-DD') : undefined,
                } as any,
              }
            : prev,
        );
      }
    } catch {
      message.error('更新失败');
    }
  };

  const totalStock = (record: SkuRow) => {
    const total = record.totalAvailableQty;
    if (total === undefined) return { total: '-', worstStatus: 'normal' as const };
    return { total: total.toFixed(0), worstStatus: record.stockStatus || 'normal' };
  };

  const statusMap: Record<string, { label: string; color: string }> = {
    normal: { label: '正常', color: 'success' },
    warning: { label: '预警', color: 'warning' },
    danger: { label: '缺货', color: 'error' },
  };

  const columns = [
    {
      title: 'SKU',
      key: 'sku',
      width: 240,
      render: (_: any, record: SkuRow) => (
        <Space>
          <ProductImage src={record.pic} />
          <div style={{ overflow: 'hidden', maxWidth: 180 }}>
            <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.skuCode || '-'}</div>
            <div style={{ fontSize: 12, color: '#A0A0A0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.skuName || record.jstSkuId || '-'}</div>
          </div>
        </Space>
      ),
    },
    {
      title: '产品名称',
      key: 'productName',
      width: 160,
      render: (_: any, record: SkuRow) => (
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
          {record.product?.name || '-'}
        </span>
      ),
    },
    {
      title: '规格',
      key: 'spec',
      width: 140,
      render: (_: any, record: SkuRow) => (
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
          {record.skuName || record.propertiesValue || '-'}
        </span>
      ),
    },
    {
      title: '分类/品牌',
      key: 'category',
      width: 140,
      ellipsis: true,
      render: (_: any, record: SkuRow) => (
        <Space size={0}>
          {record.category && <Tag>{record.category}</Tag>}
          {record.brand && <Tag color="blue">{record.brand}</Tag>}
        </Space>
      ),
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
      title: '上市时间',
      key: 'launchDate',
      width: 110,
      render: (_: any, record: SkuRow) =>
        record.product?.launchDate
          ? dayjs(record.product.launchDate).format('YYYY-MM-DD')
          : '-',
    },
    {
      title: '生命周期',
      key: 'lifecycle',
      width: 100,
      render: (_: any, record: SkuRow) => {
        const stage = record.product?.lifecycleStage || record.product?.inferredLifecycleStage;
        if (!stage) return '-';
        const map = lifecycleStageMap[stage];
        return <Tag color={map.color}>{map.label}</Tag>;
      },
    },
    {
      title: '总库存',
      key: 'totalStock',
      width: 90,
      align: 'center' as const,
      render: (_: any, record: SkuRow) => {
        const { total, worstStatus } = totalStock(record);
        const map = statusMap[worstStatus];
        return (
          <Space direction="vertical" size={0} style={{ textAlign: 'center' }}>
            <span style={{ fontWeight: 600 }}>{total}</span>
            {total !== '-' && <Badge status={map.color as any} text={map.label} />}
          </Space>
        );
      },
    },
    {
      title: 'BOM',
      key: 'bom',
      width: 90,
      align: 'center' as const,
      render: (_: any, record: SkuRow) => {
        if (record.bomVersion) return <Tag color="green">{record.bomVersion}</Tag>;
        return <Tag>未配置</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: SkuRow) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); openDetail(record); }} />
          </Tooltip>
          <Tooltip title="设置安全库存">
            <Button type="text" size="small" icon={<SafetyOutlined />} onClick={(e) => { e.stopPropagation(); openSafetyModal(record); }} />
          </Tooltip>
          <Tooltip title="编辑 BOM">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openBomModal(record); }} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const detailSkuId = detailRecord ? (detailRecord.skuCode || detailRecord.jstSkuId || '') : '';
  const detailStocks = detailSkuId ? stockCache[detailSkuId] || [] : [];
  const detailBom = detailSkuId ? bomCache[detailSkuId] : undefined;
  const detailLoadingFlag = detailSkuId ? detailLoading[detailSkuId] : false;

  return (
    <div style={{ width: '100%' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card size="small">
          <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
            <Space wrap>
              <Input
                placeholder="搜索 SKU/产品名"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{ width: 260 }}
                prefix={<SearchOutlined />}
              />
              <Select
                placeholder="库存状态"
                value={status || undefined}
                onChange={(v) => { setStatus(v); setSkuPage(1); }}
                style={{ width: 140 }}
                allowClear
              >
                <Select.Option value="normal">正常</Select.Option>
                <Select.Option value="warning">预警</Select.Option>
                <Select.Option value="danger">缺货</Select.Option>
              </Select>
              <Button type="primary" onClick={() => { setSkuPage(1); loadSkus(); }}>
                查询
              </Button>
            </Space>
            <Space>
              <Button loading={syncing} onClick={handleSync} icon={<SyncOutlined />}>
                同步聚水潭
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                新建商品
              </Button>
            </Space>
          </Space>
        </Card>

        <Table
          columns={columns}
          dataSource={skuData}
          rowKey="id"
          loading={skuLoading}
          pagination={false}
          size="small"
          scroll={{ x: 1320 }}
          style={{ width: '100%' }}
          onRow={(record) => ({
            onClick: () => openDetail(record),
            style: { cursor: 'pointer' },
          })}
        />

        <Pagination
          current={skuPage}
          pageSize={skuPageSize}
          total={skuTotal}
          showSizeChanger
          showTotal={(t) => `共 ${t} 条`}
          onChange={(p, ps) => {
            setSkuPage(p);
            setSkuPageSize(ps);
          }}
        />
      </Space>

      {/* 商品详情 Drawer */}
      <Drawer
        title="商品详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={720}
      >
        {detailRecord && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card
              size="small"
              title="基本信息"
              extra={
                <Button size="small" onClick={() => openLifecycleModal(detailRecord)}>
                  编辑生命周期
                </Button>
              }
            >
              <Space align="start">
                <ProductImage src={detailRecord.pic} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{detailRecord.skuCode || '-'}</div>
                  <div style={{ color: '#A0A0A0', marginTop: 4 }}>{detailRecord.skuName || detailRecord.propertiesValue || '-'}</div>
                  <div style={{ marginTop: 8 }}>
                    <Space size={0}>
                      {detailRecord.category && <Tag>{detailRecord.category}</Tag>}
                      {detailRecord.brand && <Tag color="blue">{detailRecord.brand}</Tag>}
                      {detailRecord.bomVersion ? <Tag color="green">BOM: {detailRecord.bomVersion}</Tag> : <Tag>BOM 未配置</Tag>}
                    </Space>
                  </div>
                  <div style={{ marginTop: 4, color: '#A0A0A0', fontSize: 12 }}>
                    上市时间：{detailRecord.product?.launchDate ? dayjs(detailRecord.product.launchDate).format('YYYY-MM-DD') : '未设置'}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    {(() => {
                      const stage = detailRecord.product?.lifecycleStage || detailRecord.product?.inferredLifecycleStage;
                      if (!stage) return <span style={{ color: '#A0A0A0', fontSize: 12 }}>生命周期：未设置</span>;
                      const map = lifecycleStageMap[stage];
                      return <Tag color={map.color}>{map.label}</Tag>;
                    })()}
                  </div>
                </div>
              </Space>
            </Card>

            <Tabs
              size="small"
              items={[
                {
                  key: 'stock',
                  label: (
                    <span>
                      <DatabaseOutlined /> 库存明细
                    </span>
                  ),
                  children: (
                    <div style={{ padding: '8px 0' }}>
                      {detailLoadingFlag ? (
                        <div style={{ color: '#A0A0A0', padding: 16 }}>加载中...</div>
                      ) : detailStocks.length === 0 ? (
                        <Empty description="暂无库存数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      ) : (
                        <Table
                          size="small"
                          pagination={false}
                          showHeader
                          columns={[
                            { title: '仓库', dataIndex: 'warehouseId', key: 'warehouseId' },
                            { title: '可用库存', dataIndex: 'availableQty', key: 'availableQty', render: (v: number) => <strong>{Number(v || 0).toFixed(0)}</strong> },
                            { title: '安全库存', dataIndex: 'safetyStock', key: 'safetyStock', render: (v: number) => Number(v || 0).toFixed(0) },
                            {
                              title: '状态',
                              dataIndex: 'status',
                              key: 'status',
                              render: (v: string) => {
                                const map = statusMap[v] || { label: v, color: 'default' };
                                return <Badge status={map.color as any} text={map.label} />;
                              },
                            },
                          ]}
                          dataSource={detailStocks}
                          rowKey={(r) => `${r.skuId}-${r.warehouseId}`}
                        />
                      )}
                    </div>
                  ),
                },
                {
                  key: 'bom',
                  label: (
                    <span>
                      <ExceptionOutlined /> BOM 明细
                    </span>
                  ),
                  children: (
                    <div style={{ padding: '8px 0' }}>
                      {detailLoadingFlag ? (
                        <div style={{ color: '#A0A0A0', padding: 16 }}>加载中...</div>
                      ) : !detailBom ? (
                        <Empty description="暂无 BOM 配置">
                          <Button size="small" type="primary" onClick={() => { setDetailOpen(false); openBomModal(detailRecord); }}>
                            创建 BOM
                          </Button>
                        </Empty>
                      ) : (
                        <div>
                          <Space style={{ marginBottom: 8 }}>
                            <Tag color="green">版本: {detailBom.version}</Tag>
                            {detailBom.remark && <span style={{ color: '#A0A0A0', fontSize: 12 }}>{detailBom.remark}</span>}
                          </Space>
                          <Table
                            size="small"
                            pagination={false}
                            columns={[
                              { title: '物料 SKU', dataIndex: 'materialSkuId', key: 'materialSkuId' },
                              { title: '用量', dataIndex: 'qty', key: 'qty', align: 'right' as const },
                              { title: '损耗率(%)', dataIndex: 'lossRate', key: 'lossRate', align: 'right' as const, render: (v: number) => `${v || 0}%` },
                              { title: '备注', dataIndex: 'remark', key: 'remark', render: (v: string) => v || '-' },
                            ]}
                            dataSource={detailBom.items || []}
                            rowKey="id"
                          />
                        </div>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Space>
        )}
      </Drawer>

      {/* 新建商品 */}
      <Modal title="新建商品" open={createOpen} onCancel={() => setCreateOpen(false)} footer={null} destroyOnClose>
        <Form form={createForm} layout="vertical" onFinish={handleCreateSubmit}>
          <Form.Item label="商品名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="请输入商品名称" />
          </Form.Item>
          <Form.Item label="分类" name="category">
            <Input placeholder="成品 / 原材料 / 包装" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="请输入商品描述" rows={2} />
          </Form.Item>
          <Form.Item label="上市时间" name="launchDate">
            <DatePicker placeholder="请选择上市时间" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="生命周期阶段" name="lifecycleStage">
            <Select placeholder="自动推断（基于上市时间）" allowClear>
              <Select.Option value="concept">概念/研发</Select.Option>
              <Select.Option value="launching">即将上市</Select.Option>
              <Select.Option value="new">新品</Select.Option>
              <Select.Option value="growth">成长期</Select.Option>
              <Select.Option value="mature">成熟期</Select.Option>
              <Select.Option value="decline">衰退期</Select.Option>
              <Select.Option value="discontinued">已退市</Select.Option>
            </Select>
          </Form.Item>

          <div style={{ marginBottom: 8, fontWeight: 500, color: '#111111' }}>SKU 信息</div>
          <Form.Item
            label="SKU 编码"
            name={['skus', 0, 'skuCode']}
            extra="留空将按规则自动生成，如 EM-CP-250427-001"
          >
            <Input placeholder="留空自动生成" />
          </Form.Item>
          <Form.Item
            label="SKU 名称"
            name={['skus', 0, 'skuName']}
            extra="留空将使用 商品名称 + 规格"
          >
            <Input placeholder="留空自动生成" />
          </Form.Item>
          <Form.Item label="规格" name={['skus', 0, 'spec']}>
            <Input placeholder="如：黑色 / 128GB" />
          </Form.Item>
          <Form.Item label="条形码" name={['skus', 0, 'barcode']}>
            <Input placeholder="可选" />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCreateOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* BOM 编辑 */}
      <Modal
        title={editingBom ? '编辑 BOM' : '创建 BOM'}
        open={bomModalOpen}
        onCancel={() => setBomModalOpen(false)}
        onOk={() => bomForm.submit()}
        width={720}
        destroyOnClose
      >
        <Form form={bomForm} layout="vertical" onFinish={handleSaveBom}>
          <Form.Item label="版本" name="version" initialValue="v1">
            <Input placeholder="v1" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input placeholder="可选" />
          </Form.Item>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>BOM 明细</div>
          <Table
            size="small"
            pagination={false}
            dataSource={bomFormItems}
            rowKey={(r, i) => `${r.materialSkuId}-${i}`}
            columns={[
              {
                title: '物料 SKU',
                dataIndex: 'materialSkuId',
                render: (_: any, __: any, idx: number) => (
                  <Input
                    size="small"
                    value={bomFormItems[idx]?.materialSkuId}
                    onChange={(e) => {
                      const next = [...bomFormItems];
                      next[idx] = { ...next[idx], materialSkuId: e.target.value };
                      setBomFormItems(next);
                    }}
                    placeholder="SKU ID"
                  />
                ),
              },
              {
                title: '用量',
                dataIndex: 'qty',
                render: (_: any, __: any, idx: number) => (
                  <InputNumber
                    size="small"
                    min={0.01}
                    style={{ width: 80 }}
                    value={bomFormItems[idx]?.qty}
                    onChange={(v) => {
                      const next = [...bomFormItems];
                      next[idx] = { ...next[idx], qty: Number(v) || 0 };
                      setBomFormItems(next);
                    }}
                  />
                ),
              },
              {
                title: '损耗率(%)',
                dataIndex: 'lossRate',
                render: (_: any, __: any, idx: number) => (
                  <InputNumber
                    size="small"
                    min={0}
                    max={100}
                    style={{ width: 80 }}
                    value={bomFormItems[idx]?.lossRate}
                    onChange={(v) => {
                      const next = [...bomFormItems];
                      next[idx] = { ...next[idx], lossRate: Number(v) || 0 };
                      setBomFormItems(next);
                    }}
                  />
                ),
              },
              {
                title: '备注',
                dataIndex: 'remark',
                render: (_: any, __: any, idx: number) => (
                  <Input
                    size="small"
                    value={bomFormItems[idx]?.remark || ''}
                    onChange={(e) => {
                      const next = [...bomFormItems];
                      next[idx] = { ...next[idx], remark: e.target.value };
                      setBomFormItems(next);
                    }}
                    placeholder="可选"
                  />
                ),
              },
              {
                title: '',
                width: 40,
                render: (_: any, __: any, idx: number) => (
                  <Button type="text" size="small" danger onClick={() => {
                    const next = [...bomFormItems];
                    next.splice(idx, 1);
                    setBomFormItems(next);
                  }}>
                    删除
                  </Button>
                ),
              },
            ]}
            footer={() => (
              <Button size="small" onClick={() => setBomFormItems([...bomFormItems, { materialSkuId: '', qty: 1, lossRate: 0, sortOrder: bomFormItems.length }])}>
                + 添加行
              </Button>
            )}
          />
        </Form>
        {editingBom && (
          <Button danger size="small" style={{ marginTop: 8 }} onClick={handleDeleteBom}>
            删除 BOM
          </Button>
        )}
      </Modal>

      {/* 安全库存设置 */}
      <Modal
        title="设置安全库存"
        open={safetyModalOpen}
        onCancel={() => setSafetyModalOpen(false)}
        onOk={() => safetyForm.submit()}
        destroyOnClose
      >
        <Form form={safetyForm} layout="vertical" onFinish={handleSaveSafety}>
          <Form.Item label="SKU">
            <span>{safetySkuId}</span>
          </Form.Item>
          <Form.Item
            label="仓库"
            name="warehouseId"
            rules={[{ required: true, message: '请选择仓库' }]}
          >
            <Input placeholder="仓库ID" />
          </Form.Item>
          <Form.Item
            label="安全库存"
            name="safetyStock"
            rules={[{ required: true, message: '请输入安全库存' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 生命周期编辑 */}
      <Modal
        title="编辑产品生命周期"
        open={lifecycleModalOpen}
        onCancel={() => setLifecycleModalOpen(false)}
        onOk={() => lifecycleForm.submit()}
        destroyOnClose
      >
        <Form form={lifecycleForm} layout="vertical" onFinish={handleSaveLifecycle}>
          <Form.Item label="上市时间" name="launchDate">
            <DatePicker placeholder="请选择上市时间" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="生命周期阶段" name="lifecycleStage">
            <Select placeholder="自动推断（基于上市时间）" allowClear>
              <Select.Option value="concept">概念/研发</Select.Option>
              <Select.Option value="launching">即将上市</Select.Option>
              <Select.Option value="new">新品</Select.Option>
              <Select.Option value="growth">成长期</Select.Option>
              <Select.Option value="mature">成熟期</Select.Option>
              <Select.Option value="decline">衰退期</Select.Option>
              <Select.Option value="discontinued">已退市</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
