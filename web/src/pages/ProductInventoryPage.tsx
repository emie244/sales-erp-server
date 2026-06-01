import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Input,
  message,
  Card,
  Badge,
  Tabs,
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
} from '@ant-design/icons';
import axios from '@/api/axios';
import {
  fetchProducts,
  fetchAllSkus,
  syncJushuitan,
  batchUpdateSkuCategory,
} from '@/api/products';
import { fetchBomsBySku, type BomHeader } from '@/api/boms';
import {
  fetchMaterialCategories,
  type MaterialCategory,
} from '@/api/material-categories';
import PageHeader from '@/components/PageHeader';
import MaterialCategoryPage from './MaterialCategoryPage';
import BomManagement from '@/components/BomManagement';
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

function ProductListTab() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [data, setData] = useState<Product[]>([]);
  const [, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const listWrapRef = useRef<HTMLDivElement>(null);

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
      sortField,
      sortOrder,
    }),
    [pageSize, keyword, category, isActive, lifecycleStage, brand, sortField, sortOrder],
  );

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetchProducts(buildParams(1));
        const newData = res.data || [];
        setData(newData);
        setTotal(res.total || 0);
        setPage(1);
        setHasMore(newData.length < (res.total || 0));
        extractOptions(newData);
        sessionStorage.setItem(
          'erp_product_list',
          JSON.stringify({
            data: newData,
            total: res.total || 0,
            page: 1,
            pageSize,
            keyword,
            category,
            isActive,
            lifecycleStage,
            brand,
            sortField,
            sortOrder,
          }),
        );
      } catch {
        message.error('加载产品列表失败');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [buildParams, pageSize, extractOptions, keyword, category, isActive, lifecycleStage, brand, sortField, sortOrder],
  );

  useEffect(() => {
    const cached = sessionStorage.getItem('erp_product_list');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setData(parsed.data || []);
        setTotal(parsed.total || 0);
        setHasMore((parsed.data || []).length < (parsed.total || 0));
        if (parsed.keyword) setKeyword(parsed.keyword);
        if (parsed.category) setCategory(parsed.category);
        if (parsed.isActive) setIsActive(parsed.isActive);
        if (parsed.lifecycleStage) setLifecycleStage(parsed.lifecycleStage);
        if (parsed.brand) setBrand(parsed.brand);
        if (parsed.sortField) setSortField(parsed.sortField);
        if (parsed.sortOrder) setSortOrder(parsed.sortOrder);
      } catch {}
    }
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 排序变化自动触发查询
  useEffect(() => {
    setPage(1);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortOrder]);

  // 查询按钮 / Enter 触发
  useEffect(() => {
    if (trigger > 0) {
      setPage(1);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

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

  const handleScroll = useCallback(() => {
    const el = listWrapRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - 80) {
      loadMore();
    }
  }, [loadMore]);

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
            <Tag color="blue">{p.skus?.length || 0} SKU</Tag>
            {p.lifecycleStage && (
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

  const tableColumns = [
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
      render: (v?: string) => v || '-',
    },
    {
      title: '品牌',
      key: 'brand',
      render: (_: any, record: Product) => {
        const brands = [
          ...new Set((record.skus || []).map((s) => s.brand).filter(Boolean)),
        ];
        return brands.length ? brands.join(', ') : '-';
      },
    },
    {
      title: '生命周期',
      key: 'lifecycle',
      width: 100,
      render: (_: any, record: Product) => record.lifecycleStage || '-',
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
      width: 100,
      render: (_: any, record: Product) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(`/products/${record.id}`)}
        >
          查看详情
        </Button>
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
            icon={<SyncOutlined />}
            loading={syncing}
            onClick={handleSync}
          >
            同步聚水潭
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

      <div
        ref={listWrapRef}
        onScroll={handleScroll}
        style={{ height: 'calc(100vh - 280px)', overflow: 'auto' }}
      >
        {viewMode === 'card' ? (
          cardGrid
        ) : (
          <Table
            columns={tableColumns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            pagination={false}
            virtual
            scroll={{ x: 1000 }}
            style={{ width: '100%' }}
          />
        )}
        {loadingMore && (
          <div
            style={{ textAlign: 'center', padding: '12px 0', color: '#999' }}
          >
            加载中...
          </div>
        )}
        {!hasMore && data.length > 0 && (
          <div
            style={{ textAlign: 'center', padding: '12px 0', color: '#999' }}
          >
            没有更多了
          </div>
        )}
      </div>
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
}

function SkuListTab() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<SkuRow[]>([]);
  const [, setTotal] = useState(0);
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
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const tableWrapRef = useRef<HTMLDivElement>(null);

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
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetchAllSkus({
          page: 1,
          pageSize,
          keyword: keyword || undefined,
          status: status || undefined,
          governance: governance || undefined,
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
        setPage(1);
        setHasMore(newData.length < (res.total || 0));
        setSelectedRowKeys([]);
        sessionStorage.setItem(
          'erp_sku_list',
          JSON.stringify({
            data: newData,
            total: res.total || 0,
            page: 1,
            pageSize,
            keyword,
            status,
            governance,
            sortBy,
          }),
        );
      } catch {
        message.error('加载 SKU 数据失败');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [pageSize, keyword, status, governance, sortBy],
  );

  useEffect(() => {
    const cached = sessionStorage.getItem('erp_sku_list');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setData(parsed.data || []);
        setTotal(parsed.total || 0);
        setHasMore((parsed.data || []).length < (parsed.total || 0));
        if (parsed.sortBy) setSortBy(parsed.sortBy);
      } catch {}
    }
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const res = await fetchAllSkus({
        page: nextPage,
        pageSize,
        keyword: keyword || undefined,
        status: status || undefined,
        governance: (governance as 'uncategorized') || undefined,
      });
      const newData = res.data || [];
      setData((prev) => {
        const merged = [...prev, ...newData];
        setHasMore(merged.length < (res.total || 0));
        return merged;
      });
      setPage(nextPage);
    } catch {
      message.error('加载更多失败');
    } finally {
      setLoadingMore(false);
    }
  }, [
    loading,
    loadingMore,
    hasMore,
    page,
    pageSize,
    keyword,
    status,
    governance,
  ]);

  const handleScroll = useCallback(() => {
    const el = tableWrapRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - 80) {
      loadMore();
    }
  }, [loadMore]);

  useEffect(() => {
    const urlStatus = searchParams.get('status') || '';
    if (urlStatus !== status) setStatus(urlStatus);
  }, [searchParams]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governance]);

  const loadDetail = async (skuId: string) => {
    if (stockCache[skuId] && bomCache[skuId] !== undefined) return;
    setDetailLoading((prev) => ({ ...prev, [skuId]: true }));
    try {
      const [stockRes, bomRes] = await Promise.allSettled([
        axios.get(`/stocks/${encodeURIComponent(skuId)}`),
        fetchBomsBySku(skuId),
      ]);

      const stockData =
        stockRes.status === 'fulfilled' ? (stockRes.value as any) : null;
      const bomData =
        bomRes.status === 'fulfilled' ? (bomRes.value as BomHeader[]) : [];

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
        setStockCache((prev) => ({ ...prev, [skuId]: items }));
      } else {
        setStockCache((prev) => ({ ...prev, [skuId]: [] }));
      }
      setBomCache((prev) => ({ ...prev, [skuId]: bomData }));
    } catch {
      setStockCache((prev) => ({ ...prev, [skuId]: [] }));
      setBomCache((prev) => ({ ...prev, [skuId]: [] }));
    } finally {
      setDetailLoading((prev) => ({ ...prev, [skuId]: false }));
    }
  };

  const openDetail = (record: SkuRow) => {
    setDetailRecord(record);
    setDetailOpen(true);
    const skuKey = record.skuCode || record.jstSkuId || '';
    if (skuKey) loadDetail(skuKey);
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
      title: 'SKU 名称',
      dataIndex: 'skuName',
      key: 'skuName',
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
            {v || '-'}
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
            {record.skuCode || record.jstSkuId || '-'}
          </div>
        </div>
      ),
    },
    {
      title: 'SKU 编码',
      dataIndex: 'skuCode',
      key: 'skuCode',
      width: 140,
    },
    {
      title: '聚水潭 ID',
      dataIndex: 'jstSkuId',
      key: 'jstSkuId',
      width: 140,
    },
    {
      title: '商品分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
    },
    {
      title: '物料分类',
      key: 'materialCategory',
      width: 140,
      render: (_: unknown, record: SkuRow) => {
        const isMaterial =
          record.itemType === 'semi_finished' ||
          record.itemType === 'raw_material';
        if (!isMaterial) return <span style={{ color: '#999' }}>-</span>;
        return record.materialCategoryId ? (
          <Tag color="blue">{record.materialCategoryName || '已分类'}</Tag>
        ) : (
          <Tag color="warning" icon={<WarningOutlined />}>
            待分类
          </Tag>
        );
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
        </Space>
      ),
    },
  ];

  const detailSkuId = detailRecord
    ? detailRecord.skuCode || detailRecord.jstSkuId || ''
    : '';
  const detailStocks = detailSkuId ? stockCache[detailSkuId] || [] : [];
  const detailBoms = detailSkuId ? bomCache[detailSkuId] || [] : [];
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
          {selectedRowKeys.length > 0 && (
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
            loading={syncing}
            onClick={handleSync}
            icon={<SyncOutlined />}
          >
            同步聚水潭
          </Button>
        </Space>
      </Space>

      <div
        ref={tableWrapRef}
        onScroll={handleScroll}
        style={{ height: 'calc(100vh - 280px)', overflow: 'auto' }}
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={false}
          virtual
          scroll={{ x: 1400 }}
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
        {loadingMore && (
          <div
            style={{ textAlign: 'center', padding: '12px 0', color: '#999' }}
          >
            加载中...
          </div>
        )}
        {!hasMore && data.length > 0 && (
          <div
            style={{ textAlign: 'center', padding: '12px 0', color: '#999' }}
          >
            没有更多了
          </div>
        )}
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
  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="商品管理" />
      <Tabs
        defaultActiveKey="products"
        items={[
          {
            key: 'products',
            label: '产品列表',
            children: <ProductListTab />,
          },
          {
            key: 'skus',
            label: 'SKU 列表',
            children: <SkuListTab />,
          },
          {
            key: 'boms',
            label: 'BOM 管理',
            children: <BomManagement />,
          },
          {
            key: 'categories',
            label: '物料分类',
            children: <MaterialCategoryPage />,
          },
        ]}
      />
    </div>
  );
}
