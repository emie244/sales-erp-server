import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Input,
  Form,
  Radio,
  InputNumber,
  message,
  Card,
  Badge,
  Tag,
  Tooltip,
  Empty,
  Drawer,
  Select,
  TreeSelect,
} from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  SearchOutlined,
  EyeOutlined,
  SyncOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  PictureOutlined,
  TagsOutlined,
  WarningOutlined,
  PlusOutlined,
  DownloadOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import axios from '@/api/axios';
import {
  fetchProducts,
  fetchAllSkus,
  syncJushuitan,
  batchUpdateSkuCategory,
  createProduct,
  exportAllSkus,
} from '@/api/products';
import { fetchBomsBySku, fetchBomReferences, type BomHeader, type BomReference } from '@/api/boms';
import {
  fetchMaterialCategories,
  type MaterialCategory,
} from '@/api/material-categories';
import PageHeader from '@/components/PageHeader';
import ProductImportModal from '@/components/ProductImportModal';
import MultiImageUpload from '@/components/MultiImageUpload';
import SkuCenterView from '@/components/SkuCenterView';
import type { Product, ProductSku } from '@/types';

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                      */
/* ------------------------------------------------------------------ */

const statusMap: Record<string, { label: string; color: string }> = {
  normal: { label: '正常', color: 'success' },
  warning: { label: '预警', color: 'warning' },
  danger: { label: '缺货', color: 'error' },
};

interface StockDetail {
  skuId: string;
  warehouseId: string;
  availableQty: number;
  safetyStock: number;
  status: 'normal' | 'warning' | 'danger';
}

/** 编码前缀映射 */
const ITEM_TYPE_PREFIX: Record<string, string> = {
  finished_good: 'CP',
  semi_finished: 'BCP',
  raw_material: 'YC',
  packaging: 'BC',
};

/** 新建产品时实时预览预计生成的 SPU/SKU 编码 */
function SkuCodePreview({ form }: { form: any }) {
  const itemType = Form.useWatch('itemType', form) || 'finished_good';
  const category = Form.useWatch('category', form) || '';
  const skuName = Form.useWatch('skuName', form) || '';
  const name = Form.useWatch('name', form) || '';

  const prefix = ITEM_TYPE_PREFIX[itemType] || 'CP';
  const catCode = category ? category.slice(0, 2).toUpperCase() : 'XX';
  const hasName = !!(skuName || name);

  return (
    <div
      style={{
        background: '#f6ffed',
        border: '1px dashed #b7eb8f',
        borderRadius: 8,
        padding: '12px 16px',
        marginTop: 16,
      }}
    >
      <div style={{ fontSize: 13, color: '#52c41a', marginBottom: 4 }}>
        📋 预计生成编码
      </div>
      <div style={{ fontSize: 14, fontFamily: 'monospace' }}>
        <span style={{ color: '#999' }}>SPU: </span>
        <strong style={{ color: '#389e0d' }}>
          {prefix}-{catCode}-{hasName ? 'XXXX' : '????'}
        </strong>
        <span style={{ color: '#d9d9d9', margin: '0 8px' }}>|</span>
        <span style={{ color: '#999' }}>SKU: </span>
        <strong style={{ color: '#389e0d' }}>
          {prefix}-{catCode}-{hasName ? 'XXXX-001' : '????-???'}
        </strong>
      </div>
      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
        流水号由系统自动递增分配，分类取前2位大写字母
      </div>
    </div>
  );
}

/** 48x48 thumbnail with click-to-preview */
function Thumbnail({ src, size = 48 }: { src?: string; size?: number }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const url = src?.trim();
  const isValid = url && url.startsWith('http');

  const placeholder = (
    <div
      style={{
        width: size,
        height: size,
        background: '#F0E6FF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        cursor: isValid ? 'pointer' : 'default',
      }}
    >
      <span style={{ color: '#A0A0A0', fontSize: 10 }}>
        {isValid ? '...' : '无图'}
      </span>
    </div>
  );

  if (!isValid) return placeholder;

  return (
    <div
      style={{
        width: size,
        height: size,
        overflow: 'hidden',
        borderRadius: 8,
        cursor: 'pointer',
      }}
      onClick={() => {
        Modal.info({
          title: '图片预览',
          icon: null,
          width: 520,
          content: (
            <img
              referrerPolicy="no-referrer"
              src={url}
              alt=""
              style={{
                width: '100%',
                borderRadius: 8,
                marginTop: 12,
              }}
            />
          ),
          okText: '关闭',
        });
      }}
    >
      {!loaded && !error && placeholder}
      <img
        referrerPolicy="no-referrer"
        src={url}
        alt=""
        style={{
          width: size,
          height: size,
          objectFit: 'cover',
          display: loaded && !error ? 'block' : 'none',
        }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 1: Product List                                                 */
/* ------------------------------------------------------------------ */

export function ProductListTab({ itemTypeFilter, isMaterialList }: { itemTypeFilter?: string[]; isMaterialList?: boolean } = {}) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  const [data, setData] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const cardWrapRef = useRef<HTMLDivElement>(null);

  // 新建产品弹窗
  const [modalOpen, setModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [createMode, setCreateMode] = useState<'quick' | 'step'>('quick');
  const [creating, setCreating] = useState(false);

  // 批量导入弹窗
  const [importModalOpen, setImportModalOpen] = useState(false);

  // 搜索 & 筛选状态
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState<'true' | 'false' | ''>('');
  const [lifecycleStage, setLifecycleStage] = useState('');
  const [brand, setBrand] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [trigger, setTrigger] = useState(0);

  // 从数据中收集的选项
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<{ id: string; name: string }[]>([]);
  const [itemType, setItemType] = useState<string>('finished_good');

  const extractOptions = useCallback((products: Product[]) => {
    const cats = new Set<string>();
    const brands = new Set<string>();
    for (const p of products) {
      if (p.category) cats.add(p.category);
      for (const s of p.skus || []) {
        if (s.brand) brands.add(s.brand);
      }
    }
    setCategoryOptions((prev) => {
      const merged = new Set([...prev, ...cats]);
      return Array.from(merged).sort();
    });
    setBrandOptions((prev) => {
      const merged = new Set([...prev, ...brands]);
      return Array.from(merged).sort();
    });
  }, []);

  const buildParams = useCallback(
    (pageNum: number) => ({
      page: pageNum,
      pageSize,
      ...(keyword ? { keyword } : {}),
      ...(category ? { category } : {}),
      ...(isActive ? { isActive } : {}),
      ...(lifecycleStage ? { lifecycleStage } : {}),
      ...(brand ? { brand } : {}),
      ...(itemTypeFilter ? { itemTypes: itemTypeFilter.join(',') } : {}),
      sortField,
      sortOrder,
    }),
    [pageSize, keyword, category, isActive, lifecycleStage, brand, sortField, sortOrder, itemTypeFilter],
  );

  const load = useCallback(
    async (targetPage = 1, silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetchProducts(buildParams(targetPage));
        const newData = res.data || [];
        setData(newData);
        setTotal(res.total || 0);
        setPage(targetPage);
        setHasMore(newData.length < (res.total || 0));
        extractOptions(newData);
      } catch {
        message.error('加载产品列表失败');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [buildParams, extractOptions],
  );

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await fetchProducts(buildParams(nextPage));
      const newData = res.data || [];
      setData((prev) => {
        const merged = [...prev, ...newData];
        setHasMore(merged.length < (res.total || 0));
        return merged;
      });
      extractOptions(newData);
      setPage(nextPage);
    } catch {
      message.error('加载更多失败');
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, page, buildParams, extractOptions]);

  const handleCardScroll = useCallback(() => {
    const el = cardWrapRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - 80) {
      loadMore();
    }
  }, [loadMore]);

  useEffect(() => {
    load(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // 加载供应商列表
  useEffect(() => {
    axios
      .get('/suppliers?pageSize=1000')
      .then((res: any) => {
        setSupplierOptions(
          (res?.data || []).map((s: any) => ({ id: s.id, name: s.name })),
        );
      })
      .catch(() => {});
  }, []);


  // 排序变化自动触发查询
  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortOrder]);

  // 查询按钮 / Enter 触发
  useEffect(() => {
    if (trigger > 0) {
      load(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

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

  const handleSearch = () => {
    setCategoryOptions([]);
    setBrandOptions([]);
    setTrigger((v) => v + 1);
  };

  const handleResetFilters = () => {
    setKeyword('');
    setCategory('');
    setIsActive('');
    setLifecycleStage('');
    setBrand('');
    setSortField('createdAt');
    setSortOrder('DESC');
    setCategoryOptions([]);
    setBrandOptions([]);
    setTrigger((v) => v + 1);
  };

  const firstImage = (p: Product) =>
    p.skus?.[0]?.pic || p.skus?.[0]?.localPic || '';

  function CardImage({ src }: { src?: string }) {
    const [err, setErr] = useState(false);
    if (!src || err) {
      return <PictureOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />;
    }
    return (
      <img
        referrerPolicy="no-referrer"
        src={src}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={() => setErr(true)}
      />
    );
  }

  const cardGrid = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 16,
      }}
    >
      {data.map((p) => (
        <Card
          key={p.id}
          hoverable
          onClick={() => navigate(`/products/${p.id}`)}
          cover={
            <div
              style={{
                height: 200,
                background: '#fafafa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <CardImage src={firstImage(p)} />
            </div>
          }
          bodyStyle={{ padding: 16 }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: 15,
              marginBottom: 8,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {p.name}
          </div>
          <Space wrap size={4}>
            {p.category && <Tag>{p.category}</Tag>}
            {isMaterialList ? (
              <Tag color="blue">{p.skus?.[0]?.skuCode || '-'}</Tag>
            ) : (
              <Tag color="blue">{p.skus?.length || 0} SKU</Tag>
            )}
            {!isMaterialList && p.lifecycleStage && (
              <Tag color="default">{p.lifecycleStage}</Tag>
            )}
          </Space>
        </Card>
      ))}
      {data.length === 0 && !loading && (
        <Empty description="暂无产品数据" style={{ gridColumn: '1 / -1' }} />
      )}
    </div>
  );

  const tableColumns = isMaterialList
    ? [
        {
          title: '图片',
          key: 'image',
          width: 80,
          render: (_: any, record: Product) => (
            <Thumbnail src={firstImage(record)} size={48} />
          ),
        },
        {
          title: '物料名称',
          dataIndex: 'name',
          key: 'name',
          render: (v: string, record: Product) => (
            <Button
              type="link"
              style={{ padding: 0 }}
              onClick={() => navigate(`/products/${record.id}`)}
            >
              {v}
            </Button>
          ),
        },
        {
          title: '物料编码',
          key: 'skuCode',
          width: 140,
          render: (_: any, record: Product) => record.skus?.[0]?.skuCode || '--',
        },
        {
          title: '分类',
          dataIndex: 'category',
          key: 'category',
          render: (v?: string) => v || '--',
        },
        {
          title: '成本价',
          key: 'costPrice',
          width: 100,
          render: (_: any, record: Product) => {
            const price = record.skus?.[0]?.costPrice;
            return price != null ? `¥${price}` : '--';
          },
        },
        {
          title: '重量',
          key: 'weight',
          width: 100,
          render: (_: any, record: Product) => {
            const weight = record.skus?.[0]?.weight;
            return weight != null ? `${weight}kg` : '--';
          },
        },
        {
          title: '状态',
          key: 'status',
          width: 80,
          render: (_: any, record: Product) => (
            <Tag color={record.isActive ? 'success' : 'default'}>
              {record.isActive ? '启用' : '禁用'}
            </Tag>
          ),
        },
        {
          title: '操作',
          key: 'action',
          width: 140,
          render: (_: any, record: Product) => (
            <Space>
              <Button
                type="link"
                size="small"
                onClick={() => navigate(`/products/${record.id}`)}
              >
                查看详情
              </Button>
              <Button
                type="link"
                size="small"
                danger
                onClick={async () => {
                  Modal.confirm({
                    title: '确认删除',
                    content: `确定删除物料「${record.name}」吗？`,
                    onOk: async () => {
                      try {
                        await axios.delete(`/products/${record.id}`);
                        message.success('删除成功');
                        load();
                      } catch (e: any) {
                        message.error(e?.response?.data?.message || '删除失败');
                      }
                    },
                  });
                }}
              >
                删除
              </Button>
            </Space>
          ),
        },
      ]
    : [
        {
          title: '图片',
          key: 'image',
          width: 80,
          render: (_: any, record: Product) => (
            <Thumbnail src={firstImage(record)} size={48} />
          ),
        },
        {
          title: '产品名称',
          dataIndex: 'name',
          key: 'name',
          render: (v: string, record: Product) => (
            <Button
              type="link"
              style={{ padding: 0 }}
              onClick={() => navigate(`/products/${record.id}`)}
            >
              {v}
            </Button>
          ),
        },
        {
          title: '分类',
          dataIndex: 'category',
          key: 'category',
          render: (v?: string) => v || '--',
        },
        {
          title: '品牌',
          key: 'brand',
          render: (_: any, record: Product) => {
            const brands = [
              ...new Set((record.skus || []).map((s) => s.brand).filter(Boolean)),
            ];
            return brands.length ? brands.join(', ') : '--';
          },
        },
        {
          title: '生命周期',
          key: 'lifecycle',
          width: 100,
          render: (_: any, record: Product) => record.lifecycleStage || '--',
        },
        {
          title: '状态',
          key: 'status',
          width: 80,
          render: (_: any, record: Product) => (
            <Tag color={record.isActive ? 'success' : 'default'}>
              {record.isActive ? '启用' : '禁用'}
            </Tag>
          ),
        },
        {
          title: 'SKU 数量',
          key: 'skuCount',
          width: 100,
          render: (_: any, record: Product) => record.skus?.length || 0,
        },
        {
          title: '操作',
          key: 'action',
          width: 140,
          render: (_: any, record: Product) => (
            <Space>
              <Button
                type="link"
                size="small"
                onClick={() => navigate(`/products/${record.id}`)}
              >
                查看详情
              </Button>
              <Button
                type="link"
                size="small"
                danger
                onClick={async () => {
                  Modal.confirm({
                    title: '确认删除',
                    content: `确定删除产品「${record.name}」吗？关联的 SKU 也会被删除。`,
                    onOk: async () => {
                      try {
                        await axios.delete(`/products/${record.id}`);
                        message.success('删除成功');
                        load();
                      } catch (e: any) {
                        message.error(e?.response?.data?.message || '删除失败');
                      }
                    },
                  });
                }}
              >
                删除
              </Button>
        </Space>
      ),
    },
  ];

  const lifecycleOptions = [
    { label: '概念期', value: 'concept' },
    { label: '上市期', value: 'launching' },
    { label: '新品', value: 'new' },
    { label: '成长期', value: 'growth' },
    { label: '成熟期', value: 'mature' },
    { label: '衰退期', value: 'decline' },
    { label: '停产', value: 'discontinued' },
  ];

  const hasActiveFilters =
    keyword || category || isActive || lifecycleStage || brand;

  return (
    <div>
      <Space
        wrap
        style={{
          marginBottom: 16,
          justifyContent: 'space-between',
          width: '100%',
        }}
        className="page-search-bar"
      >
        <Space wrap>
          <Input.Search
            placeholder="搜索名称/描述/分类"
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 220 }}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="分类"
            value={category || undefined}
            onChange={(v) => {
              setCategory(v || '');
            }}
            style={{ width: 140 }}
            allowClear
            showSearch
            options={categoryOptions.map((c) => ({ label: c, value: c }))}
          />
          <Select
            placeholder="状态"
            value={isActive || undefined}
            onChange={(v) => {
              setIsActive(v || '');
            }}
            style={{ width: 120 }}
            allowClear
            options={[
              { label: '启用', value: 'true' },
              { label: '禁用', value: 'false' },
            ]}
          />
          <Select
            placeholder="生命周期"
            value={lifecycleStage || undefined}
            onChange={(v) => {
              setLifecycleStage(v || '');
            }}
            style={{ width: 140 }}
            allowClear
            showSearch
            options={lifecycleOptions}
          />
          <Select
            placeholder="品牌"
            value={brand || undefined}
            onChange={(v) => {
              setBrand(v || '');
            }}
            style={{ width: 140 }}
            allowClear
            showSearch
            options={brandOptions.map((b) => ({ label: b, value: b }))}
          />
          <Select
            value={`${sortField}-${sortOrder}`}
            onChange={(v) => {
              const [field, order] = v.split('-');
              setSortField(field);
              setSortOrder(order as 'ASC' | 'DESC');
            }}
            style={{ width: 160 }}
            options={[
              { label: '创建时间 ↓', value: 'createdAt-DESC' },
              { label: '创建时间 ↑', value: 'createdAt-ASC' },
              { label: '名称 A-Z', value: 'name-ASC' },
              { label: '名称 Z-A', value: 'name-DESC' },
              { label: '上市日期 ↓', value: 'launchDate-DESC' },
              { label: '上市日期 ↑', value: 'launchDate-ASC' },
            ]}
          />
          <Button type="primary" onClick={handleSearch}>
            查询
          </Button>
          {hasActiveFilters && (
            <Button onClick={handleResetFilters}>重置</Button>
          )}
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => {
              setCreateMode('quick');
              createForm.resetFields();
              setModalOpen(true);
            }}
          >
            新建产品
          </Button>
          <Button
            icon={<SyncOutlined />}
            loading={syncing}
            onClick={handleSync}
          >
            同步聚水潭
          </Button>
          <Button
            icon={<ImportOutlined />}
            onClick={() => setImportModalOpen(true)}
          >
            批量导入
          </Button>
        </Space>
        <Space>
          <Tooltip title="卡片视图">
            <Button
              icon={<AppstoreOutlined />}
              type={viewMode === 'card' ? 'primary' : 'default'}
              onClick={() => setViewMode('card')}
            />
          </Tooltip>
          <Tooltip title="表格视图">
            <Button
              icon={<UnorderedListOutlined />}
              type={viewMode === 'table' ? 'primary' : 'default'}
              onClick={() => setViewMode('table')}
            />
          </Tooltip>
        </Space>
      </Space>

      {viewMode === 'card' ? (
        <div
          ref={cardWrapRef}
          onScroll={handleCardScroll}
          style={{ height: 'calc(100vh - 280px)', overflow: 'auto' }}
        >
          {cardGrid}
          {loadingMore && (
            <div style={{ textAlign: 'center', padding: '12px 0', color: '#999' }}>
              加载中...
            </div>
          )}
          {!hasMore && data.length > 0 && (
            <div style={{ textAlign: 'center', padding: '12px 0', color: '#999' }}>
              没有更多了
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            width: '100%',
            height: 'calc(100vh - 104px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Table
            columns={tableColumns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            sticky
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: false,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p) => load(p),
            }}
            scroll={{ x: 1000, y: 'calc(100vh - 360px)' }}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* 新建产品弹窗 */}
      <Modal
        title="新建产品"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => createForm.submit()}
        width={640}
        destroyOnClose
        confirmLoading={creating}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={async (values) => {
            setCreating(true);
            try {
              const isMaterial = values.itemType !== 'finished_good';
              // 快速创建非成品时，name 从 skuName 自动获取
              const productName = values.name || values.skuName;
              if (!productName) {
                message.error('请输入产品/物料名称');
                setCreating(false);
                return;
              }
              const payload: any = {
                name: productName,
                category: values.category,
                lifecycleStage: isMaterial ? undefined : values.lifecycleStage,
                itemType: values.itemType,
                launchDate: values.launchDate?.format('YYYY-MM-DD'),
              };

              if (createMode === 'quick') {
                payload.skus = [
                  {
                    skuName: values.skuName,
                    spec: values.spec,
                    salePrice: values.salePrice,
                    costPrice: values.costPrice,
                    weight: values.weight,
                    pics: values.pics || [],
                    pic: values.pics?.[0],
                    brand: values.brand,
                    itemType: values.itemType || 'finished_good',
                    defaultSupplierId: values.defaultSupplierId,
                  },
                ];
              }

              await createProduct(payload, { mode: createMode });
              message.success(
                createMode === 'quick' ? '产品创建成功' : '产品草稿保存成功',
              );
              setModalOpen(false);
              createForm.resetFields();
              load();
            } catch (e: any) {
              message.error(e?.response?.data?.message || e?.message || '创建失败');
            } finally {
              setCreating(false);
            }
          }}
        >
          <Form.Item label="创建模式">
            <Radio.Group
              value={createMode}
              onChange={(e) => setCreateMode(e.target.value)}
            >
              <Radio value="quick">快速创建（同时创建首个 SKU）</Radio>
              <Radio value="step">分步创建（仅创建产品信息）</Radio>
            </Radio.Group>
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
              onChange={(value) => setItemType(value)}
            />
          </Form.Item>

          {itemType === 'finished_good' && (
            <Form.Item
              label="产品名称"
              name="name"
              rules={[{ required: true }]}
            >
              <Input placeholder="请输入产品名称" />
            </Form.Item>
          )}

          {itemType !== 'finished_good' && createMode === 'step' && (
            <Form.Item
              label="物料名称"
              name="name"
              rules={[{ required: true }]}
            >
              <Input placeholder="请输入物料名称" />
            </Form.Item>
          )}

          {/* 快速创建非成品时，name 从 skuName 自动获取 */}
          {itemType !== 'finished_good' && createMode === 'quick' && (
            <Form.Item
              label="物料名称"
              name="name"
              rules={[{ required: true, message: '请输入物料名称' }]}
              hidden
            >
              <Input />
            </Form.Item>
          )}

          {itemType === 'finished_good' && (
            <Form.Item label="产品分类" name="category">
              <Select
                placeholder="请选择分类"
                allowClear
                showSearch
                notFoundContent={
                  categoryOptions.length === 0
                    ? '暂无分类，请先创建产品或在输入框中直接输入新分类'
                    : '无匹配结果'
                }
                options={categoryOptions.map((c) => ({ label: c, value: c }))}
              />
            </Form.Item>
          )}

          {itemType === 'finished_good' && (
            <>
              <Form.Item label="品牌" name="brand">
                <Select
                  placeholder="请选择品牌"
                  allowClear
                  showSearch
                  notFoundContent={
                    brandOptions.length === 0
                      ? '暂无品牌，请先创建产品或在输入框中直接输入新品牌'
                      : '无匹配结果'
                  }
                  options={brandOptions.map((b) => ({ label: b, value: b }))}
                />
              </Form.Item>

              <Form.Item label="生命周期阶段" name="lifecycleStage">
                <Select
                  placeholder="请选择"
                  allowClear
                  options={[
                    { label: '概念期', value: 'concept' },
                    { label: '上市期', value: 'launching' },
                    { label: '新品', value: 'new' },
                    { label: '成长期', value: 'growth' },
                    { label: '成熟期', value: 'mature' },
                    { label: '衰退期', value: 'decline' },
                    { label: '停产', value: 'discontinued' },
                  ]}
                />
              </Form.Item>
            </>
          )}

          {itemType !== 'finished_good' && (
            <Form.Item label="默认供应商" name="defaultSupplierId">
              <Select
                placeholder="请选择供应商"
                allowClear
                showSearch
                options={supplierOptions.map((s) => ({ label: s.name, value: s.id }))}
              />
            </Form.Item>
          )}

          {createMode === 'quick' && (
            <>
              {itemType === 'finished_good' && (
                <Form.Item
                  label="SKU 规格名称"
                  name="skuName"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="如：黑色 10000mAh" />
                </Form.Item>
              )}

              {itemType !== 'finished_good' && (
                <Form.Item
                  label="物料名称"
                  name="skuName"
                  rules={[{ required: true }]}
                >
                  <Input placeholder="如：锂电池 10000mAh" />
                </Form.Item>
              )}

              <Form.Item label="规格" name="spec">
                <Input placeholder="如：10000mAh / 黑色" />
              </Form.Item>

              <Space>
                {itemType === 'finished_good' && (
                  <Form.Item label="销售价" name="salePrice">
                    <InputNumber
                      placeholder="¥"
                      min={0}
                      precision={2}
                      style={{ width: 140 }}
                    />
                  </Form.Item>
                )}
                <Form.Item label="成本价" name="costPrice">
                  <InputNumber
                    placeholder="¥"
                    min={0}
                    precision={2}
                    style={{ width: 140 }}
                  />
                </Form.Item>
                <Form.Item label="重量(kg)" name="weight">
                  <InputNumber
                    placeholder="kg"
                    min={0}
                    precision={3}
                    style={{ width: 140 }}
                  />
                </Form.Item>
              </Space>

              <Form.Item
                label={itemType === 'finished_good' ? '产品图片' : '物料图片'}
                name="pics"
                initialValue={[]}
              >
                <MultiImageUpload
                  maxCount={9}
                  onUpload={async (files) => {
                    // 新建产品时 SKU 尚未创建，使用本地 URL 预览
                    const urls = files.map((f) => URL.createObjectURL(f));
                    const current = createForm.getFieldValue('pics') || [];
                    createForm.setFieldsValue({ pics: [...current, ...urls] });
                    return [...current, ...urls];
                  }}
                />
              </Form.Item>
            </>
          )}

          {/* 编码预览 */}
          <SkuCodePreview form={createForm} />
        </Form>
      </Modal>
      <ProductImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => {
          setTrigger((v) => v + 1);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 2: SKU List                                                     */
/* ------------------------------------------------------------------ */

interface SkuRow extends ProductSku {
  totalAvailableQty?: number;
  stockStatus?: 'normal' | 'warning' | 'danger';
  bomVersion?: string | null;
  syncStatus?: string;
  syncErrorMessage?: string | null;
  localStockQty?: number;
  inTransitQty?: number;
  bomDemandQty?: number;
}

export function SkuListTab({
  itemTypes,
  excludeTypes = 'semi_finished,raw_material,packaging',
}: {
  itemTypes?: string;
  excludeTypes?: string;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<SkuRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>(
    searchParams.get('status') || '',
  );
  const [governance, setGovernance] = useState<
    'uncategorized' | 'item_type_null' | 'non_compliant' | ''
  >('');
  const [sortBy, setSortBy] = useState<string>('');
  const [syncing, setSyncing] = useState(false);

  const [stockCache, setStockCache] = useState<Record<string, StockDetail[]>>(
    {},
  );
  const [bomCache, setBomCache] = useState<Record<string, BomHeader[]>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>(
    {},
  );

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<SkuRow | null>(null);
  const [referenceCache, setReferenceCache] = useState<Record<string, BomReference[]>>({});

  const [materialCategories, setMaterialCategories] = useState<
    MaterialCategory[]
  >([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchCategoryId, setBatchCategoryId] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    fetchMaterialCategories()
      .then(setMaterialCategories)
      .catch(() => {});
  }, []);

  const flatCategories = useCallback(
    (list: MaterialCategory[]): MaterialCategory[] => {
      const result: MaterialCategory[] = [];
      for (const item of list) {
        result.push(item);
        if (item.children?.length) {
          result.push(...flatCategories(item.children));
        }
      }
      return result;
    },
    [],
  );

  interface CategoryTreeNode {
    title: string;
    value: string;
    children?: CategoryTreeNode[];
  }

  const categoryTreeData = useCallback(
    (list: MaterialCategory[]): CategoryTreeNode[] =>
      list.map((c) => ({
        title: `${c.code} - ${c.name}`,
        value: c.id,
        children: c.children ? categoryTreeData(c.children) : undefined,
      })),
    [],
  );

  const load = useCallback(
    async (targetPage = page, silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetchAllSkus({
          page: targetPage,
          pageSize,
          keyword: keyword || undefined,
          status: status || undefined,
          governance: governance || undefined,
          ...(itemTypes ? { itemTypes } : { excludeTypes }),
        });
        let newData = res.data || [];
        if (sortBy) {
          const [field, order] = sortBy.split(':');
          newData = [...newData].sort((a, b) => {
            let av: number | string = 0;
            let bv: number | string = 0;
            if (field === 'skuName') {
              av = (a.skuName || '').toLowerCase();
              bv = (b.skuName || '').toLowerCase();
            } else if (field === 'skuCode') {
              av = (a.skuCode || '').toLowerCase();
              bv = (b.skuCode || '').toLowerCase();
            } else if (field === 'salePrice') {
              av = Number(a.salePrice || 0);
              bv = Number(b.salePrice || 0);
            } else if (field === 'totalAvailableQty') {
              av = Number((a as SkuRow).totalAvailableQty ?? -1);
              bv = Number((b as SkuRow).totalAvailableQty ?? -1);
            }
            if (typeof av === 'string' && typeof bv === 'string') {
              return order === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
            }
            return order === 'asc' ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
          });
        }
        setData(newData);
        setTotal(res.total || 0);
        setPage(targetPage);
        setSelectedRowKeys([]);
      } catch {
        message.error('加载 SKU 数据失败');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [page, pageSize, keyword, status, governance, sortBy, itemTypes, excludeTypes],
  );

  useEffect(() => {
    load(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const urlStatus = searchParams.get('status') || '';
    if (urlStatus !== status) setStatus(urlStatus);
  }, [searchParams]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governance]);

  const loadDetail = async (record: SkuRow) => {
    const skuKey = record.skuCode || record.jstSkuId || record.id;
    const isMaterialSku = !!itemTypes;
    const hasStock = stockCache[skuKey] !== undefined;
    const hasBom = bomCache[skuKey] !== undefined;
    const hasRef = referenceCache[skuKey] !== undefined;

    if (hasStock && (!isMaterialSku ? hasBom : hasRef)) return;

    setDetailLoading((prev) => ({ ...prev, [skuKey]: true }));
    try {
      const promises: Promise<any>[] = [
        axios.get(`/stocks/${encodeURIComponent(skuKey)}`),
      ];
      if (!isMaterialSku) {
        promises.push(fetchBomsBySku(skuKey));
      } else {
        promises.push(fetchBomReferences(skuKey));
      }

      const [stockRes, secondRes] = await Promise.allSettled(promises);

      const stockData =
        stockRes.status === 'fulfilled' ? (stockRes.value as any) : null;
      if (Array.isArray(stockData)) {
        const items = stockData.map((s: any) => {
          const availableQty = Number(s.availableQty || 0);
          const safetyStock = Number(s.safetyStock || 0);
          let st: 'normal' | 'warning' | 'danger' = 'normal';
          if (safetyStock > 0 && availableQty <= 0) st = 'danger';
          else if (safetyStock > 0 && availableQty < safetyStock)
            st = 'warning';
          return {
            skuId: s.skuId,
            warehouseId: s.warehouseId,
            availableQty,
            safetyStock,
            status: st,
          };
        });
        setStockCache((prev) => ({ ...prev, [skuKey]: items }));
      } else {
        setStockCache((prev) => ({ ...prev, [skuKey]: [] }));
      }

      if (!isMaterialSku) {
        const bomData = secondRes?.status === 'fulfilled' ? (secondRes.value as BomHeader[]) : [];
        setBomCache((prev) => ({ ...prev, [skuKey]: bomData }));
      } else {
        const refData = secondRes?.status === 'fulfilled' ? (secondRes.value as BomReference[]) : [];
        setReferenceCache((prev) => ({ ...prev, [skuKey]: refData }));
      }
    } catch {
      if (!stockCache[skuKey]) setStockCache((prev) => ({ ...prev, [skuKey]: [] }));
      if (!isMaterialSku) setBomCache((prev) => ({ ...prev, [skuKey]: [] }));
      else setReferenceCache((prev) => ({ ...prev, [skuKey]: [] }));
    } finally {
      setDetailLoading((prev) => ({ ...prev, [skuKey]: false }));
    }
  };

  const openDetail = (record: SkuRow) => {
    setDetailRecord(record);
    setDetailOpen(true);
    loadDetail(record);
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

  const totalStock = (record: SkuRow) => {
    const total = record.totalAvailableQty;
    if (total === undefined)
      return { total: '-', worstStatus: 'normal' as const };
    return {
      total: total.toFixed(0),
      worstStatus: record.stockStatus || 'normal',
    };
  };

  const columns = [
    {
      title: 'SKU 图片',
      key: 'image',
      width: 80,
      render: (_: any, record: SkuRow) => (
        <Thumbnail src={record.pic} size={48} />
      ),
    },
    {
      title: 'SKU 名称/编码',
      dataIndex: 'skuName',
      key: 'skuName',
      width: 200,
      render: (v: string, record: SkuRow) => (
        <div>
          <div
            style={{
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 180,
            }}
          >
            {v || '--'}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#A0A0A0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 180,
            }}
          >
            {record.skuCode || record.jstSkuId || '--'}
          </div>
        </div>
      ),
    },
    {
      title: '分类',
      key: 'category',
      width: 130,
      render: (_: unknown, record: SkuRow) => {
        const isMaterial =
          record.itemType === 'semi_finished' ||
          record.itemType === 'raw_material' ||
          record.itemType === 'packaging';
        if (isMaterial) {
          return record.materialCategoryId ? (
            <Tag color="blue">{record.materialCategoryName || '已分类'}</Tag>
          ) : (
            <Tag color="warning" icon={<WarningOutlined />}>
              待分类
            </Tag>
          );
        }
        return record.category || '--';
      },
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
      width: 100,
      render: (v?: string) => v || '-',
    },
    {
      title: '销售价',
      dataIndex: 'salePrice',
      key: 'salePrice',
      width: 100,
      align: 'right' as const,
      render: (v: number) => (v != null ? `¥${v}` : '-'),
    },
    {
      title: '库存状态',
      key: 'stockStatus',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: SkuRow) => {
        const { total, worstStatus } = totalStock(record);
        const map = statusMap[worstStatus];
        return (
          <Space direction="vertical" size={0} style={{ textAlign: 'center' }}>
            <span style={{ fontWeight: 600 }}>{total}</span>
            {total !== '-' && (
              <Badge status={map.color as any} text={map.label} />
            )}
          </Space>
        );
      },
    },
    {
      title: '本地库存',
      key: 'localStockQty',
      width: 90,
      align: 'right' as const,
      render: (_: any, record: SkuRow) => {
        const qty = Number(record.localStockQty || 0);
        return <span style={{ color: qty > 0 ? '#52c41a' : '#999' }}>{qty}</span>;
      },
    },
    {
      title: '在途数量',
      key: 'inTransitQty',
      width: 90,
      align: 'right' as const,
      render: (_: any, record: SkuRow) => {
        const qty = Number(record.inTransitQty || 0);
        return qty > 0 ? <Tag color="blue">{qty}</Tag> : <span style={{ color: '#999' }}>0</span>;
      },
    },
    {
      title: 'BOM需求',
      key: 'bomDemandQty',
      width: 90,
      align: 'right' as const,
      render: (_: any, record: SkuRow) => {
        const qty = Number(record.bomDemandQty || 0);
        return qty > 0 ? <Tag color="orange">{qty}</Tag> : <span style={{ color: '#999' }}>0</span>;
      },
    },
    {
      title: '同步状态',
      key: 'syncStatus',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: SkuRow) => {
        const status = record.syncStatus || 'pending';
        const statusMap: Record<string, { label: string; color: string }> = {
          pending: { label: '待同步', color: 'default' },
          syncing: { label: '同步中', color: 'processing' },
          synced: { label: '已同步', color: 'success' },
          failed: { label: '失败', color: 'error' },
        };
        const map = statusMap[status] || statusMap.pending;
        return (
          <Space direction="vertical" size={0}>
            <Tag color={map.color}>{map.label}</Tag>
            {status === 'failed' && (
              <Button
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: retry sync
                  message.info('重试同步功能开发中');
                }}
              >
                重试
              </Button>
            )}
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: SkuRow) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                openDetail(record);
              }}
            />
          </Tooltip>
          {itemTypes ? (
            <Button
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                openDetail(record);
              }}
            >
              被引用详情
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                navigate(
                  `/boms?skuId=${record.jstSkuId || record.skuCode || ''}`,
                );
              }}
            >
              查看 BOM
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const detailSkuId = detailRecord
    ? detailRecord.skuCode || detailRecord.jstSkuId || ''
    : '';
  const detailStocks = detailSkuId ? stockCache[detailSkuId] || [] : [];
  const detailBoms = detailSkuId ? bomCache[detailSkuId] || [] : [];
  const detailReferences = detailSkuId ? referenceCache[detailSkuId] || [] : [];
  const detailLoadingFlag = detailSkuId ? detailLoading[detailSkuId] : false;

  return (
    <div>
      <Space
        wrap
        style={{
          marginBottom: 16,
          justifyContent: 'space-between',
          width: '100%',
        }}
        className="page-search-bar"
      >
        <Space wrap>
          <Input
            placeholder="搜索 SKU/产品名"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            prefix={<SearchOutlined />}
            onPressEnter={() => {
              setPage(1);
              load();
            }}
          />
          <Select
            placeholder="库存状态"
            value={status || undefined}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            style={{ width: 140 }}
            allowClear
          >
            <Select.Option value="normal">正常</Select.Option>
            <Select.Option value="warning">预警</Select.Option>
            <Select.Option value="danger">缺货</Select.Option>
          </Select>
          <Button
            type="primary"
            onClick={() => {
              setPage(1);
              load();
            }}
          >
            查询
          </Button>
          <Select
            placeholder="排序"
            value={sortBy || undefined}
            onChange={(v) => {
              setSortBy(v);
              setPage(1);
              load();
            }}
            style={{ width: 160 }}
            allowClear
          >
            <Select.Option value="skuName:asc">SKU名称 A-Z</Select.Option>
            <Select.Option value="skuName:desc">SKU名称 Z-A</Select.Option>
            <Select.Option value="skuCode:asc">SKU编码 A-Z</Select.Option>
            <Select.Option value="skuCode:desc">SKU编码 Z-A</Select.Option>
            <Select.Option value="salePrice:desc">销售价从高到低</Select.Option>
            <Select.Option value="salePrice:asc">销售价从低到高</Select.Option>
            <Select.Option value="totalAvailableQty:desc">库存从高到低</Select.Option>
            <Select.Option value="totalAvailableQty:asc">库存从低到高</Select.Option>
          </Select>
          {itemTypes && (
            <Button
              type={governance === 'uncategorized' ? 'primary' : 'default'}
              danger={governance === 'uncategorized'}
              icon={<WarningOutlined />}
              onClick={() => {
                setGovernance(
                  governance === 'uncategorized' ? '' : 'uncategorized',
                );
                setPage(1);
              }}
            >
              待分类物料
            </Button>
          )}
          <Button
            type={governance === 'item_type_null' ? 'primary' : 'default'}
            icon={<TagsOutlined />}
            onClick={() => {
              setGovernance(
                governance === 'item_type_null' ? '' : 'item_type_null',
              );
              setPage(1);
            }}
          >
            未归类大类
          </Button>
          <Button
            type={governance === 'non_compliant' ? 'primary' : 'default'}
            danger={governance === 'non_compliant'}
            icon={<WarningOutlined />}
            onClick={() => {
              setGovernance(
                governance === 'non_compliant' ? '' : 'non_compliant',
              );
              setPage(1);
            }}
          >
            编码不合规
          </Button>
          {itemTypes && selectedRowKeys.length > 0 && (
            <Button
              type="primary"
              icon={<TagsOutlined />}
              onClick={() => setBatchModalOpen(true)}
            >
              批量挂分类 ({selectedRowKeys.length})
            </Button>
          )}
        </Space>
        <Space>
          <Button
            onClick={() => {
              exportAllSkus({ keyword: keyword || undefined, status: status || undefined, governance: (governance as 'uncategorized') || undefined, ...(itemTypes ? { itemTypes } : { excludeTypes }) });
            }}
            icon={<DownloadOutlined />}
          >
            导出
          </Button>
          <Button
            loading={syncing}
            onClick={handleSync}
            icon={<SyncOutlined />}
          >
            同步聚水潭
          </Button>
        </Space>
      </Space>

      <div
        style={{
          width: '100%',
          height: 'calc(100vh - 104px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          sticky
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p) => load(p),
          }}
          scroll={{ x: 'max-content', y: 'calc(100vh - 360px)' }}
          style={{ width: '100%' }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
          }}
          onRow={(record) => ({
            onClick: () => openDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      </div>

      {/* SKU 详情 Drawer */}
      <Drawer
        title="SKU 详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={720}
      >
        {detailRecord && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card size="small" title="基本信息">
              <Space align="start">
                <Thumbnail src={detailRecord.pic} size={64} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>
                    {detailRecord.skuName || '-'}
                  </div>
                  <div style={{ color: '#A0A0A0', marginTop: 4 }}>
                    {detailRecord.skuCode || detailRecord.jstSkuId || '-'}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Space size={0}>
                      {detailRecord.category && (
                        <Tag>{detailRecord.category}</Tag>
                      )}
                      {detailRecord.brand && (
                        <Tag color="blue">{detailRecord.brand}</Tag>
                      )}
                      {detailRecord.bomVersion ? (
                        <Tag color="green">BOM: {detailRecord.bomVersion}</Tag>
                      ) : (
                        <Tag>BOM 未配置</Tag>
                      )}
                    </Space>
                  </div>
                </div>
              </Space>
            </Card>

            <Card size="small" title="库存明细">
              {detailLoadingFlag ? (
                <div style={{ color: '#A0A0A0', padding: 16 }}>加载中...</div>
              ) : detailStocks.length === 0 ? (
                <Empty
                  description="暂无库存数据"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <Table
                  size="small"
                  pagination={false}
                  columns={[
                    {
                      title: '仓库',
                      dataIndex: 'warehouseId',
                      key: 'warehouseId',
                    },
                    {
                      title: '可用库存',
                      dataIndex: 'availableQty',
                      key: 'availableQty',
                      render: (v: number) => (
                        <strong>{Number(v || 0).toFixed(0)}</strong>
                      ),
                    },
                    {
                      title: '安全库存',
                      dataIndex: 'safetyStock',
                      key: 'safetyStock',
                      render: (v: number) => Number(v || 0).toFixed(0),
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      render: (v: string) => {
                        const map = statusMap[v] || {
                          label: v,
                          color: 'default',
                        };
                        return (
                          <Badge status={map.color as any} text={map.label} />
                        );
                      },
                    },
                  ]}
                  dataSource={detailStocks}
                  rowKey={(r) => `${r.skuId}-${r.warehouseId}`}
                />
              )}
            </Card>

            {itemTypes ? (
              <Card size="small" title="被引用产品">
                {detailLoadingFlag ? (
                  <div style={{ color: '#A0A0A0', padding: 16 }}>加载中...</div>
                ) : detailReferences.length === 0 ? (
                  <Empty description="暂无产品引用该物料" />
                ) : (
                  <Table
                    size="small"
                    pagination={false}
                    columns={[
                      {
                        title: '产品',
                        render: (_: any, r: BomReference) => (
                          <div>
                            <div style={{ fontWeight: 500 }}>{r.productName || '-'}</div>
                            <div style={{ fontSize: 12, color: '#999' }}>{r.skuCode || r.skuId}</div>
                          </div>
                        ),
                      },
                      {
                        title: 'BOM版本',
                        dataIndex: 'version',
                        width: 100,
                        render: (v: string, r: BomReference) => (
                          <Space>
                            <Tag>{v}</Tag>
                            {r.isActive && <Tag color="success">生效中</Tag>}
                          </Space>
                        ),
                      },
                      {
                        title: '用量',
                        dataIndex: 'qty',
                        width: 80,
                        align: 'right' as const,
                      },
                      {
                        title: '损耗率',
                        dataIndex: 'lossRate',
                        width: 90,
                        align: 'right' as const,
                        render: (v: number) => `${v || 0}%`,
                      },
                    ]}
                    dataSource={detailReferences}
                    rowKey={(r) => `${r.bomId}-${r.skuId}`}
                  />
                )}
              </Card>
            ) : (
              <Card size="small" title="BOM 明细">
                {detailLoadingFlag ? (
                  <div style={{ color: '#A0A0A0', padding: 16 }}>加载中...</div>
                ) : detailBoms.length === 0 ? (
                  <Empty description="暂无 BOM 配置" />
                ) : (
                  <div>
                    {detailBoms.map((bom) => (
                      <div
                        key={bom.id}
                        style={{
                          marginBottom: 16,
                          padding: 12,
                          border: '1px solid #f0f0f0',
                          borderRadius: 4,
                        }}
                      >
                        <Space style={{ marginBottom: 8 }}>
                          <Tag color={bom.isActive ? 'green' : 'default'}>
                            版本: {bom.version}
                          </Tag>
                          {bom.isActive && <Tag color="success">生效中</Tag>}
                        </Space>
                        <Table
                          size="small"
                          pagination={false}
                          columns={[
                            {
                              title: '物料 SKU',
                              dataIndex: 'materialSkuId',
                              key: 'materialSkuId',
                            },
                            {
                              title: '用量',
                              dataIndex: 'qty',
                              key: 'qty',
                              align: 'right' as const,
                            },
                            {
                              title: '损耗率(%)',
                              dataIndex: 'lossRate',
                              key: 'lossRate',
                              align: 'right' as const,
                              render: (v: number) => `${v || 0}%`,
                            },
                            {
                              title: '备注',
                              dataIndex: 'remark',
                              key: 'remark',
                              render: (v: string) => v || '-',
                            },
                          ]}
                          dataSource={bom.items || []}
                          rowKey="id"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </Space>
        )}
      </Drawer>

      {/* 批量挂分类 Modal */}
      <Modal
        title={`批量挂分类 (${selectedRowKeys.length} 个 SKU)`}
        open={batchModalOpen}
        onCancel={() => {
          setBatchModalOpen(false);
          setBatchCategoryId(null);
        }}
        onOk={async () => {
          if (!batchCategoryId) {
            message.error('请先选择分类');
            return;
          }
          setBatchLoading(true);
          try {
            await batchUpdateSkuCategory({
              skuIds: selectedRowKeys,
              materialCategoryId: batchCategoryId,
            });
            message.success('批量挂分类成功');
            setBatchModalOpen(false);
            setBatchCategoryId(null);
            setSelectedRowKeys([]);
            load();
          } catch {
            message.error('批量挂分类失败');
          } finally {
            setBatchLoading(false);
          }
        }}
        confirmLoading={batchLoading}
      >
        <TreeSelect
          treeData={categoryTreeData(materialCategories)}
          placeholder="选择物料分类"
          style={{ width: '100%' }}
          value={batchCategoryId}
          onChange={(v) => setBatchCategoryId(v)}
          treeDefaultExpandAll
        />
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */

export default function ProductInventoryPage() {
  const [itemTypeFilter, setItemTypeFilter] = useState<string | undefined>(undefined);

  const typeButtons = [
    { key: 'all', label: '全部', value: undefined },
    { key: 'finished', label: '成品', value: 'finished_good' },
    { key: 'semi', label: '半成品', value: 'semi_finished' },
    { key: 'raw', label: '原材料', value: 'raw_material' },
    { key: 'packaging', label: '包材', value: 'packaging' },
  ];

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="商品管理" />
      <div style={{ marginBottom: 12 }}>
        <Space>
          {typeButtons.map((btn) => (
            <Button
              key={btn.key}
              type={itemTypeFilter === btn.value ? 'primary' : 'default'}
              onClick={() => setItemTypeFilter(btn.value)}
            >
              {btn.label}
            </Button>
          ))}
        </Space>
      </div>
      <SkuCenterView
        itemType={itemTypeFilter}
      />
    </div>
  );
}
