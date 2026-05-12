import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Table,
  Spin,
  Empty,
  Tag,
  Button,
  Space,
  message,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import {
  fetchPurchaseOrderById,
  fetchPurchaseOrderStatusLogs,
  type PurchaseOrder,
  type PurchaseOrderStatusLog,
} from '@/api/purchase-orders';
import { fetchBomById } from '@/api/boms';
import { fetchAllSkus } from '@/api/products';
import PageHeader from '@/components/PageHeader';
import { formatDateTime } from '@/utils/datetime';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  pending_approval: { text: '审批中', color: 'processing' },
  approved: { text: '已审批', color: 'success' },
  partial_received: { text: '部分到货', color: 'warning' },
  received: { text: '已全部到货', color: 'success' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'error' },
};

interface BomGroup {
  bomId: string;
  bomVersion: string;
  finishedSkuName: string;
  finishedSkuCode: string;
  items: PurchaseOrder['items'];
}

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLogs, setStatusLogs] = useState<PurchaseOrderStatusLog[]>([]);
  const [bomGroups, setBomGroups] = useState<BomGroup[]>([]);
  const [normalItems, setNormalItems] = useState<PurchaseOrder['items']>([]);
  const [allSkus, setAllSkus] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    loadData();
    loadSkus();
  }, [id]);

  const loadSkus = async () => {
    try {
      const res = await fetchAllSkus({ pageSize: 9999 });
      setAllSkus(res.data || []);
    } catch {
      // ignore
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [orderData, logs] = await Promise.all([
        fetchPurchaseOrderById(id!),
        fetchPurchaseOrderStatusLogs(id!),
      ]);
      setOrder(orderData);
      setStatusLogs(logs);

      // Group items by bomId
      const items = orderData.items || [];
      const bomMap: Record<string, PurchaseOrder['items']> = {};
      const normal: PurchaseOrder['items'] = [];

      for (const item of items) {
        if (item.bomId) {
          if (!bomMap[item.bomId]) bomMap[item.bomId] = [];
          bomMap[item.bomId].push(item);
        } else {
          normal.push(item);
        }
      }

      setNormalItems(normal);

      // Fetch BOM details for groups
      const groupList: BomGroup[] = [];
      for (const bomId of Object.keys(bomMap)) {
        try {
          const bom = await fetchBomById(bomId);
          const finishedSku = allSkus.find(
            (s) => s.skuCode === bom.skuId || s.jstSkuId === bom.skuId,
          );
          groupList.push({
            bomId,
            bomVersion: bom.version,
            finishedSkuName:
              finishedSku?.skuName || finishedSku?.product?.name || bom.skuId,
            finishedSkuCode: finishedSku?.skuCode || bom.skuId,
            items: bomMap[bomId],
          });
        } catch {
          groupList.push({
            bomId,
            bomVersion: '未知版本',
            finishedSkuName: '未知成品',
            finishedSkuCode: '',
            items: bomMap[bomId],
          });
        }
      }
      setBomGroups(groupList);
    } catch {
      message.error('加载采购单详情失败');
    } finally {
      setLoading(false);
    }
  };

  const itemColumns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'SKU 编码',
      dataIndex: 'skuCode',
      key: 'skuCode',
      render: (v: string) => v || '-',
    },
    {
      title: 'SKU 名称',
      dataIndex: 'skuName',
      key: 'skuName',
      render: (v: string) => v || '-',
    },
    {
      title: '数量',
      dataIndex: 'qty',
      key: 'qty',
      align: 'right' as const,
    },
    {
      title: '已到货',
      dataIndex: 'receivedQty',
      key: 'receivedQty',
      align: 'right' as const,
      render: (v: number) => v || 0,
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      align: 'right' as const,
      render: (v: number) => `¥${parseFloat(v?.toString() || '0').toFixed(2)}`,
    },
    {
      title: '小计',
      dataIndex: 'lineAmount',
      key: 'lineAmount',
      align: 'right' as const,
      render: (v: number) => `¥${parseFloat(v?.toString() || '0').toFixed(2)}`,
    },
    {
      title: '供应商',
      dataIndex: 'supplierName',
      key: 'supplierName',
      render: (v: string) => v || '-',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (v: string) => v || '-',
    },
  ];

  const logColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '变更',
      key: 'change',
      width: 200,
      render: (_: any, record: PurchaseOrderStatusLog) => {
        const from = record.fromStatus
          ? STATUS_MAP[record.fromStatus]?.text || record.fromStatus
          : '-';
        const to = STATUS_MAP[record.toStatus]?.text || record.toStatus;
        return `${from} → ${to}`;
      },
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (v: string | null) => v || '-',
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!order) {
    return (
      <Empty
        description="未找到采购单"
        style={{ marginTop: 80 }}
      />
    );
  }

  return (
    <div>
      <PageHeader title="采购单详情">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/purchase-orders')}
        >
          返回列表
        </Button>
      </PageHeader>

      <Card style={{ marginBottom: 24 }}>
        <Descriptions title="基本信息" bordered size="small" column={2}>
          <Descriptions.Item label="采购单号">
            {order.orderNo}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={STATUS_MAP[order.status]?.color || 'default'}>
              {STATUS_MAP[order.status]?.text || order.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="供应商">
            {order.supplierName || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="总金额">
            ¥{parseFloat(order.totalAmount?.toString() || '0').toFixed(2)}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {formatDateTime(order.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="审批实例">
            {order.approvalInstanceCode || '-'}
          </Descriptions.Item>
          {order.remark && (
            <Descriptions.Item label="备注" span={2}>
              {order.remark}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* BOM 分组明细 */}
      {bomGroups.map((group) => (
        <Card
          key={group.bomId}
          style={{ marginBottom: 16 }}
          title={
            <Space>
              <span style={{ fontWeight: 600 }}>
                成品：{group.finishedSkuName}
              </span>
              <Tag color="blue">{group.finishedSkuCode}</Tag>
              <span style={{ color: '#999' }}>|</span>
              <span>BOM 版本：{group.bomVersion}</span>
            </Space>
          }
        >
          <Table
            rowKey="id"
            columns={itemColumns}
            dataSource={group.items}
            pagination={false}
            size="small"
            bordered
          />
        </Card>
      ))}

      {/* 普通采购项 */}
      {normalItems.length > 0 && (
        <Card
          style={{ marginBottom: 16 }}
          title={<span style={{ fontWeight: 600 }}>普通采购项</span>}
        >
          <Table
            rowKey="id"
            columns={itemColumns}
            dataSource={normalItems}
            pagination={false}
            size="small"
            bordered
          />
        </Card>
      )}

      {/* 状态变更记录 */}
      {statusLogs.length > 0 && (
        <Card style={{ marginBottom: 16 }} title="状态变更记录">
          <Table
            rowKey="id"
            columns={logColumns}
            dataSource={statusLogs}
            pagination={false}
            size="small"
            bordered
          />
        </Card>
      )}
    </div>
  );
}
