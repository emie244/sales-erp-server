import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Select,
  message,
  Popconfirm,
  Tag,
  InputNumber,
  Divider,
  Input,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  EditOutlined,
} from '@ant-design/icons';
import {
  fetchProductionOrders,
  createProductionOrder,
  updateProductionOrder,
  deleteProductionOrder,
  completeProductionOrder,
} from '@/api/production-orders';
import {
  fetchBomsBySku,
  fetchBomById,
  fetchProducibleProducts,
  fetchMaxProducibleQty,
} from '@/api/boms';
import { fetchSkus } from '@/api/products';
import { fetchAvailableBatches } from '@/api/purchase-orders';
import PageHeader from '@/components/PageHeader';
import { hasPermission } from '@/utils/permissions';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'default' },
  processing: { text: '加工中', color: 'processing' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'error' },
};

export default function ProductionOrderPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [products, setProducts] = useState<any[]>([]);
  const [skus, setSkus] = useState<any[]>([]);
  const [bomVersions, setBomVersions] = useState<any[]>([]);
  const [bomDetail, setBomDetail] = useState<any>(null);
  const [allocationMap, setAllocationMap] = useState<Record<string, string>>(
    {},
  );
  const [batchMap, setBatchMap] = useState<Record<string, any[]>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<any>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [maxQty, setMaxQty] = useState<number | null>(null);

  const loadData = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const res = await fetchProductionOrders({
        page: p,
        pageSize: ps,
        status: statusFilter,
        keyword: keyword || undefined,
      });
      setData(res.data);
      setTotal(res.total ?? 0);
    } catch {
      message.error('加载加工单列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadProductsData = async () => {
    try {
      const data = await fetchProducibleProducts();
      setProducts(data || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadData();
    loadProductsData();
  }, []);

  useEffect(() => {
    loadData(1);
    setPage(1);
  }, [statusFilter, keyword]);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    setSkus([]);
    setBomVersions([]);
    setBomDetail(null);
    setAllocationMap({});
    setBatchMap({});
    setMaxQty(null);
    setModalOpen(true);
  };

  const handleProductChange = async (productId: string) => {
    form.setFieldValue('skuId', undefined);
    form.setFieldValue('bomId', undefined);
    setBomVersions([]);
    setBomDetail(null);
    setAllocationMap({});
    setBatchMap({});
    setMaxQty(null);
    if (!productId) {
      setSkus([]);
      return;
    }
    try {
      const skuList = await fetchSkus(productId);
      setSkus(skuList || []);
    } catch {
      setSkus([]);
    }
  };

  const handleSkuChange = async (skuId: string) => {
    form.setFieldValue('bomId', undefined);
    setBomVersions([]);
    setBomDetail(null);
    setAllocationMap({});
    setBatchMap({});
    setMaxQty(null);
    if (!skuId) {
      return;
    }
    const sku = skus.find((s) => s.id === skuId);
    const skuCode = sku?.skuCode || sku?.jstSkuId || skuId;
    try {
      const boms = await fetchBomsBySku(skuCode);
      setBomVersions(boms || []);
    } catch {
      setBomVersions([]);
    }
  };

  const handleBomChange = async (bomId: string) => {
    setBomDetail(null);
    setAllocationMap({});
    setBatchMap({});
    setMaxQty(null);
    const bom = bomVersions.find((b) => b.id === bomId);
    if (!bom) return;
    setBomDetail(bom);

    const items = bom.items || [];
    const newBatchMap: Record<string, any[]> = {};

    await Promise.all(
      items.map(async (item: any) => {
        try {
          const batches = await fetchAvailableBatches(item.materialSkuId);
          newBatchMap[item.materialSkuId] = batches || [];
        } catch {
          newBatchMap[item.materialSkuId] = [];
        }
      }),
    );
    setBatchMap(newBatchMap);

    try {
      const res = await fetchMaxProducibleQty(bomId);
      setMaxQty(res.maxQty);
      if (res.maxQty > 0) {
        form.setFieldValue(
          'qty',
          Math.min(form.getFieldValue('qty') || 1, res.maxQty),
        );
      }
    } catch {
      setMaxQty(0);
    }
  };

  const handleQtyChange = (value: number | null) => {
    const qty = value ?? 0;
    form.setFieldValue('qty', qty);
    setAllocationMap({});
  };

  const openEdit = async (record: any) => {
    setEditingId(record.id);
    form.resetFields();
    setSkus([]);
    setBomVersions([]);
    setBomDetail(null);
    setAllocationMap({});
    setBatchMap({});
    setMaxQty(null);

    try {
      const bom = await fetchBomById(record.bomId);
      if (products.length === 0) {
        const data = await fetchProducibleProducts();
        setProducts(data || []);
      }
      const skuList = await fetchSkus(bom.productId);
      setSkus(skuList || []);
      const boms = await fetchBomsBySku(bom.skuId);
      setBomVersions(boms || []);

      const selectedBom = boms.find((b: any) => b.id === record.bomId);
      setBomDetail(selectedBom || null);

      const matchingSku = skuList.find(
        (s) => s.jstSkuId === bom.skuId || s.skuCode === bom.skuId,
      );

      // 加载可用批次
      if (selectedBom?.items?.length) {
        const newBatchMap: Record<string, any[]> = {};
        await Promise.all(
          selectedBom.items.map(async (item: any) => {
            try {
              const batches = await fetchAvailableBatches(item.materialSkuId);
              newBatchMap[item.materialSkuId] = batches || [];
            } catch {
              newBatchMap[item.materialSkuId] = [];
            }
          }),
        );
        setBatchMap(newBatchMap);
      }

      // 计算最大可加工数量
      try {
        const res = await fetchMaxProducibleQty(record.bomId);
        setMaxQty(res.maxQty);
      } catch {
        setMaxQty(0);
      }

      // 回显 allocation
      const newAllocationMap: Record<string, string> = {};
      (record.items || []).forEach((item: any) => {
        const alloc = item.allocations?.[0];
        if (alloc) {
          newAllocationMap[item.materialSkuId] = alloc.purchaseOrderItemId;
        }
      });
      setAllocationMap(newAllocationMap);

      form.setFieldsValue({
        productId: bom.productId,
        skuId: matchingSku?.id || bom.skuId,
        bomId: record.bomId,
        qty: record.qty,
        remark: record.remark,
      });
    } catch {
      form.setFieldsValue({
        bomId: record.bomId,
        qty: record.qty,
        remark: record.remark,
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (values: any) => {
    try {
      const allocations = Object.entries(allocationMap)
        .filter(([, purchaseOrderItemId]) => purchaseOrderItemId)
        .map(([materialSkuId, purchaseOrderItemId]) => ({
          materialSkuId,
          purchaseOrderItemId,
        }));

      const payload = {
        ...values,
        allocations: allocations.length ? allocations : undefined,
      };

      if (editingId) {
        await updateProductionOrder(editingId, payload);
        message.success('更新成功');
      } else {
        await createProductionOrder(payload);
        message.success('创建成功');
      }
      setModalOpen(false);
      loadData();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProductionOrder(id);
      message.success('删除成功');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleComplete = async (id: string) => {
    setCompletingId(id);
    try {
      await completeProductionOrder(id);
      message.success('加工完成，库存已更新');
      loadData();
    } catch {
      message.error('完成加工失败');
    } finally {
      setCompletingId(null);
    }
  };

  const openDetail = (record: any) => {
    setDetailRecord(record);
    setDetailModalOpen(true);
  };

  const columns = [
    {
      title: '加工单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 160,
      fixed: 'left' as const,
    },
    {
      title: '成品SKU',
      key: 'sku',
      width: 180,
      ellipsis: true,
      render: (_: any, record: any) => record.skuName || record.skuId,
    },
    {
      title: '计划数量',
      dataIndex: 'qty',
      key: 'qty',
      width: 100,
      align: 'right' as const,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const s = STATUS_MAP[v] || { text: v, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 160,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small" style={{ minHeight: 24 }}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(record)}
          >
            详情
          </Button>
          {record.status === 'pending' &&
            hasPermission('production_order:edit') && (
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              >
                编辑
              </Button>
            )}
          {(record.status === 'pending' || record.status === 'processing') &&
            hasPermission('production_order:complete') && (
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                loading={completingId === record.id}
                onClick={() => handleComplete(record.id)}
              >
                完成加工
              </Button>
            )}
          {record.status === 'pending' &&
            hasPermission('production_order:delete') && (
              <Popconfirm
                title="确认删除？"
                onConfirm={() => handleDelete(record.id)}
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                >
                  删除
                </Button>
              </Popconfirm>
            )}
        </Space>
      ),
    },
  ];

  const qty = form.getFieldValue('qty') || 1;
  const allocationItems = (bomDetail?.items || []).map((item: any) => {
    const requiredQty = Number(
      (item.qty * qty * (1 + (item.lossRate || 0) / 100)).toFixed(4),
    );
    return {
      ...item,
      requiredQty,
      batches: batchMap[item.materialSkuId] || [],
    };
  });

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="加工入库">
        {hasPermission('production_order:create') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建加工单
          </Button>
        )}
      </PageHeader>
      <Space wrap style={{ marginBottom: 16, flexShrink: 0 }}>
        <Input
          placeholder="搜索单号/SKU"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder="状态"
          value={statusFilter || undefined}
          onChange={(v) => setStatusFilter(v)}
          style={{ width: 120 }}
          allowClear
          options={Object.entries(STATUS_MAP).map(([k, v]) => ({
            value: k,
            label: v.text,
          }))}
        />
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        sticky
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
            loadData(p, ps);
          },
        }}
        scroll={{ x: 740, y: 'calc(100vh - 360px)' }}
        style={{ width: '100%' }}
      />

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editingId ? '编辑加工单' : '新建加工单'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        width={720}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="productId"
            label="产品"
            rules={[{ required: true, message: '请选择产品' }]}
          >
            <Select
              placeholder="选择产品"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={products.map((p) => ({ value: p.id, label: p.name }))}
              onChange={handleProductChange}
            />
          </Form.Item>
          <Form.Item
            name="skuId"
            label="规格型号"
            rules={[{ required: true, message: '请选择规格型号' }]}
          >
            <Select
              placeholder="选择规格型号"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={skus.map((s) => ({
                value: s.id,
                label: `${s.propertiesValue || s.skuName || s.skuCode || s.jstSkuId || s.id}${s.skuCode ? ' [' + s.skuCode + ']' : ''}`,
              }))}
              onChange={handleSkuChange}
            />
          </Form.Item>
          <Form.Item
            name="bomId"
            label="BOM 版本"
            rules={[{ required: true, message: '请选择BOM版本' }]}
          >
            <Select
              placeholder="选择BOM版本"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              options={bomVersions.map((b) => ({
                value: b.id,
                label: `${b.skuName || b.skuCode || b.skuId} (v${b.version || '1'}, ${b.items?.length || 0}种原材料)`,
              }))}
              onChange={handleBomChange}
            />
          </Form.Item>
          <Form.Item
            name="qty"
            label="计划加工数量"
            rules={[{ required: true, message: '请输入数量' }]}
          >
            <InputNumber
              min={0.0001}
              max={maxQty ?? undefined}
              step={0.01}
              style={{ width: '100%' }}
              onChange={handleQtyChange}
              disabled={maxQty === 0}
            />
          </Form.Item>
          {maxQty !== null && maxQty > 0 && (
            <div style={{ fontSize: 13, color: '#52c41a', marginBottom: 16 }}>
              根据采购单到货数量，最多可加工 {maxQty} 个
            </div>
          )}
          {maxQty === 0 && (
            <div style={{ fontSize: 13, color: '#ff4d4f', marginBottom: 16 }}>
              原材料采购数量不足，暂无法加工
            </div>
          )}
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="备注" />
          </Form.Item>

          {bomDetail && allocationItems.length > 0 && (
            <>
              <Divider>原材料采购分配</Divider>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
                为每种原材料选择对应的采购批次（已到货的采购单）。缺采购单的原材料可留空。
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {allocationItems.map((item: any) => (
                  <div
                    key={item.materialSkuId}
                    style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                  >
                    <div style={{ width: 180, fontSize: 13 }}>
                      <div style={{ fontWeight: 500 }}>
                        {item.materialSkuId}
                      </div>
                      <div style={{ color: '#999', fontSize: 12 }}>
                        需求: {item.requiredQty}
                        {item.lossRate > 0 ? ` (含损耗 ${item.lossRate}%)` : ''}
                      </div>
                    </div>
                    <Select
                      placeholder={
                        item.batches.length ? '选择采购批次' : '暂无到货采购单'
                      }
                      style={{ flex: 1 }}
                      allowClear
                      value={allocationMap[item.materialSkuId] || undefined}
                      onChange={(value) => {
                        setAllocationMap((prev) => ({
                          ...prev,
                          [item.materialSkuId]: value,
                        }));
                      }}
                      options={item.batches.map((batch: any) => ({
                        value: batch.purchaseOrderItemId,
                        label: `${batch.orderNo} (${batch.supplierName || '-'}, 到货 ${batch.receivedQty})`,
                      }))}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="加工单详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={720}
      >
        {detailRecord && (
          <div style={{ marginTop: 16 }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="加工单号">
                {detailRecord.orderNo}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_MAP[detailRecord.status]?.color}>
                  {STATUS_MAP[detailRecord.status]?.text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="成品SKU">
                {detailRecord.skuName || detailRecord.skuId}
              </Descriptions.Item>
              <Descriptions.Item label="计划数量">
                {detailRecord.qty}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {detailRecord.remark || '-'}
              </Descriptions.Item>
            </Descriptions>
            <Divider>原材料消耗明细</Divider>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detailRecord.items || []}
              columns={[
                {
                  title: '原材料SKU',
                  dataIndex: 'materialSkuId',
                  key: 'sku',
                  render: (v: string, r: any) => r.materialSkuName || v,
                },
                {
                  title: '需求数量',
                  dataIndex: 'requiredQty',
                  key: 'requiredQty',
                  align: 'right' as const,
                },
                {
                  title: '实际消耗',
                  dataIndex: 'actualQty',
                  key: 'actualQty',
                  align: 'right' as const,
                },
                {
                  title: '采购批次',
                  key: 'allocation',
                  render: (_: any, r: any) => {
                    const alloc = r.allocations?.[0];
                    return alloc ? (
                      <Tag color="blue">{alloc.purchaseOrderItemId}</Tag>
                    ) : (
                      <span style={{ color: '#999' }}>-</span>
                    );
                  },
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
