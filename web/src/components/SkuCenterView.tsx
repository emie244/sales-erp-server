import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  SearchOutlined,
  SyncOutlined,
  PlusOutlined,
  DownloadOutlined,
  WarningOutlined,
  BuildOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { fetchAllSkus, syncJushuitan, exportAllSkus } from '@/api/products';
import SkuDetailPanel from './SkuDetailPanel';
import ProductFormDrawer from './ProductFormDrawer';
import type { ProductSku } from '@/types';

interface Props {
  itemType?: string;
}

interface SkuRow extends ProductSku {
  totalAvailableQty?: number;
  stockStatus?: 'normal' | 'warning' | 'danger';
  syncStatus?: string;
  localStockQty?: number;
  inTransitQty?: number;
  bomDemandQty?: number;
}

const statusMap: Record<string, { label: string; color: string }> = {
  normal: { label: '正常', color: 'success' },
  warning: { label: '预警', color: 'warning' },
  danger: { label: '缺货', color: 'error' },
};

export default function SkuCenterView({ itemType }: Props) {
  const [data, setData] = useState<SkuRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>('');
  const [syncing, setSyncing] = useState(false);

  const [detailSku, setDetailSku] = useState<SkuRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 缓存物料SKU列表（用于BOM选择器）
  const [allMaterialSkus, setAllMaterialSkus] = useState<
    { id: string; skuName?: string; skuCode?: string; itemType?: string }[]
  >([]);

  const load = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      try {
        const params: any = {
          page: targetPage,
          pageSize,
          keyword: keyword || undefined,
          status: status || undefined,
          ...(itemType ? { itemTypes: itemType } : { excludeTypes: '' }),
        };
        const res = await fetchAllSkus(params);
        setData(res.data || []);
        setTotal(res.total || 0);
        setPage(targetPage);
      } catch {
        message.error('加载 SKU 数据失败');
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, keyword, status, itemType],
  );

  useEffect(() => {
    load(1);
  }, [itemType, status, keyword]);

  // 加载所有物料SKU（用于BOM选择器）
  useEffect(() => {
    fetchAllSkus({ pageSize: 1000, itemTypes: 'semi_finished,raw_material,packaging' })
      .then((res) => {
        setAllMaterialSkus(
          (res.data || []).map((s: ProductSku) => ({
            id: s.id,
            skuName: s.skuName,
            skuCode: s.skuCode,
            itemType: s.itemType || undefined,
          })),
        );
      })
      .catch(() => {});
  }, []);

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

  const openDetail = (record: SkuRow) => {
    setDetailSku(record);
    setDetailOpen(true);
  };

  const totalStock = (record: SkuRow) => {
    const t = record.totalAvailableQty;
    if (t === undefined) return { total: '-', worstStatus: 'normal' as const };
    return { total: t.toFixed(0), worstStatus: record.stockStatus || 'normal' };
  };

  const columns = [
    {
      title: 'SKU 图片',
      key: 'image',
      width: 80,
      render: (_: any, record: SkuRow) => (
        <img
          src={record.pic || 'https://placehold.co/48x48?text=No+Image'}
          alt=""
          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://placehold.co/48x48?text=No+Image';
          }}
        />
      ),
    },
    {
      title: 'SKU 名称/编码',
      dataIndex: 'skuName',
      key: 'skuName',
      width: 200,
      render: (v: string, record: SkuRow) => (
        <div>
          <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
            {v || '--'}
          </div>
          <div style={{ fontSize: 12, color: '#A0A0A0' }}>
            {record.skuCode || record.jstSkuId || '--'}
          </div>
        </div>
      ),
    },
    {
      title: '产品',
      key: 'product',
      width: 140,
      render: (_: any, record: SkuRow) => record.product?.name || '--',
    },
    {
      title: '分类',
      key: 'category',
      width: 120,
      render: (_: any, record: SkuRow) => {
        const isMaterial = record.itemType === 'semi_finished' || record.itemType === 'raw_material' || record.itemType === 'packaging';
        if (isMaterial) {
          return record.materialCategoryId ? (
            <Tag color="blue">{record.materialCategoryName || '已分类'}</Tag>
          ) : (
            <Tag color="warning" icon={<WarningOutlined />}>待分类</Tag>
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
      render: (v?: string) => v || '--',
    },
    {
      title: '销售价',
      dataIndex: 'salePrice',
      key: 'salePrice',
      width: 100,
      align: 'right' as const,
      render: (v: number) => (v != null ? `¥${v}` : '--'),
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
            {total !== '-' && <Tag color={map.color as any}>{map.label}</Tag>}
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
      title: '在途',
      key: 'inTransitQty',
      width: 80,
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
      width: 100,
      align: 'center' as const,
      render: (_: any, record: SkuRow) => {
        const s = record.syncStatus || 'pending';
        const map: Record<string, { label: string; color: string }> = {
          pending: { label: '待同步', color: 'default' },
          syncing: { label: '同步中', color: 'processing' },
          synced: { label: '已同步', color: 'success' },
          failed: { label: '失败', color: 'error' },
        };
        const m = map[s] || map.pending;
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: () => (
        <div style={{ display: 'flex', gap: 4, width: '100%', height: '100%', alignItems: 'center' }}>
          <Tooltip title="查看详情">
            <Button type="text" size="small" icon={<EyeOutlined />} />
          </Tooltip>
          <Tooltip title="查看BOM">
            <Button type="text" size="small" icon={<BuildOutlined />} />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 工具栏 */}
      <Space
        wrap
        style={{
          marginBottom: 12,
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <Space wrap>
          <Input
            placeholder="搜索 SKU/产品名"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            prefix={<SearchOutlined />}
            onPressEnter={() => load(1)}
            allowClear
          />
          <Select
            placeholder="库存状态"
            value={status || undefined}
            onChange={(v) => setStatus(v)}
            style={{ width: 140 }}
            allowClear
          >
            <Select.Option value="normal">正常</Select.Option>
            <Select.Option value="warning">预警</Select.Option>
            <Select.Option value="danger">缺货</Select.Option>
          </Select>
          <Button type="primary" onClick={() => load(1)}>
            查询
          </Button>
        </Space>
        <Space wrap>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => exportAllSkus({ keyword: keyword || undefined, status: status || undefined, ...(itemType ? { itemTypes: itemType } : {}) })}
          >
            导出
          </Button>
          <Button loading={syncing} onClick={handleSync} icon={<SyncOutlined />}>
            同步聚水潭
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            新建
          </Button>
        </Space>
      </Space>

      {/* 表格 */}
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
        onRow={(record) => ({
          onClick: (e) => {
            const target = e.target as HTMLElement;
            const actionCell = target.closest('td:last-child');
            const isActionButton = !!target.closest('button');
            // 点击操作列空白区域不打开详情，点击操作列按钮则打开
            if (actionCell && !isActionButton) return;
            openDetail(record as SkuRow);
          },
          style: { cursor: 'pointer' },
        })}
      />

      {/* SKU 详情面板 */}
      <SkuDetailPanel
        sku={detailSku}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onRefresh={() => load(page)}
        allMaterialSkus={allMaterialSkus}
      />

      {/* 新建产品 Drawer */}
      <ProductFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={() => load(1)}
      />
    </div>
  );
}
