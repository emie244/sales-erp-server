import { useState, useEffect } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm,
  Tag, InputNumber, Card, Divider,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SendOutlined, InboxOutlined,
} from '@ant-design/icons';
import {
  fetchPurchaseOrders, createPurchaseOrder, updatePurchaseOrder,
  deletePurchaseOrder, submitPurchaseOrder, receivePurchaseOrder,
} from '@/api/purchase-orders';
import { fetchSuppliers } from '@/api/suppliers';
import { fetchProducts, fetchSkus, fetchAllSkus } from '@/api/products';
import PageHeader from '@/components/PageHeader';
import { hasPermission } from '@/utils/permissions';
import { fetchUserProfile } from '@/api/users';
import { FEISHU_APPROVAL_DEF_CODE } from '@/config';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  pending_approval: { text: '审批中', color: 'processing' },
  approved: { text: '已审批', color: 'success' },
  partial_received: { text: '部分到货', color: 'warning' },
  received: { text: '已全部到货', color: 'success' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'error' },
};

const filterOption = (
  input: string,
  option?: { label: string; value: string },
) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase());

export default function PurchaseOrderPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [allSkus, setAllSkus] = useState<any[]>([]);
  const [skuMap, setSkuMap] = useState<Record<string, any[]>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveForm] = Form.useForm();
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receivingItems, setReceivingItems] = useState<any[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [feishuUserId, setFeishuUserId] = useState<string | null>(null);

  const loadData = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const res = await fetchPurchaseOrders({
        page: p, pageSize: ps, status: statusFilter,
        supplierId: supplierFilter, keyword: keyword || undefined,
      });
      setData(res.data);
      setTotal(res.total ?? 0);
    } catch {
      message.error('加载采购单列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const res = await fetchSuppliers();
      setSuppliers(res || []);
    } catch { /* ignore */ }
  };

  const loadProductsAndSkus = async () => {
    try {
      const [productsRes, skusRes] = await Promise.all([
        fetchProducts({ pageSize: 1000 }).then((res) => res.data).catch(() => []),
        fetchAllSkus({ pageSize: 9999 }).then((res) => res.data || []).catch(() => []),
      ]);
      setProducts(productsRes);
      setAllSkus(skusRes);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadData();
    loadSuppliers();
    loadProductsAndSkus();
    const username = localStorage.getItem('erp_username');
    if (username) {
      fetchUserProfile(username).then((u: any) => {
        if (u?.feishuUserId) setFeishuUserId(u.feishuUserId);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    loadData(1);
    setPage(1);
  }, [statusFilter, supplierFilter, keyword]);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    setSkuMap({});
    setModalOpen(true);
  };

  const openEdit = async (record: any) => {
    setEditingId(record.id);
    setSkuMap({});

    const items = (record.items || []).map((i: any) => ({
      skuId: i.skuId,
      qty: i.qty,
      unitPrice: i.unitPrice,
      lineAmount: Number((Number(i.qty || 0) * Number(i.unitPrice || 0)).toFixed(2)),
      remark: i.remark,
    }));

    // 从已加载的 SKU 中查找 productId
    const newSkuMap: Record<string, any[]> = {};
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const sku = allSkus.find((s: any) => (s.jstSkuId || s.id) === item.skuId);
      if (sku?.product?.id) {
        item.productId = sku.product.id;
        try {
          const skus = await fetchSkus(sku.product.id);
          newSkuMap[i] = skus;
        } catch {
          newSkuMap[i] = [];
        }
      }
    }
    setSkuMap(newSkuMap);

    form.setFieldsValue({
      supplierId: record.supplierId,
      remark: record.remark,
      items,
    });
    setModalOpen(true);
  };

  const handleProductChange = (productId: string, index: number) => {
    fetchSkus(productId)
      .then((list) => {
        setSkuMap((prev) => ({ ...prev, [index]: list }));
        if (list.length > 0) {
          form.setFieldValue(['items', index, 'skuId'], list[0].id);
        } else {
          form.setFieldValue(['items', index, 'skuId'], undefined);
          message.warning('该产品暂无 SKU，请先在产品管理中补充');
        }
        recalcLineAmount(index);
      })
      .catch(() => {});
  };

  const recalcLineAmount = (index: number) => {
    const items = form.getFieldValue('items') || [];
    const item = items[index];
    if (!item) return;
    const qty = Number(item.qty) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const lineAmount = Number((qty * unitPrice).toFixed(2));
    form.setFieldValue(['items', index, 'lineAmount'], lineAmount);
  };

  const handleSave = async (values: any) => {
    try {
      const allSkusList = Object.values(skuMap).flat();
      const payload = {
        ...values,
        items: values.items.map((item: any) => {
          const sku = allSkusList.find((s: any) => s.id === item.skuId)
            || allSkus.find((s: any) => (s.jstSkuId || s.id) === item.skuId);
          return {
            ...item,
            skuCode: sku?.skuCode || '',
            skuName: sku?.skuName || sku?.product?.name || sku?.propertiesValue || sku?.skuCode || item.skuId,
            lineAmount: Number((Number(item.qty || 0) * Number(item.unitPrice || 0)).toFixed(2)),
          };
        }),
      };
      if (editingId) {
        await updatePurchaseOrder(editingId, payload);
        message.success('更新成功');
      } else {
        await createPurchaseOrder(payload);
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
      await deletePurchaseOrder(id);
      message.success('删除成功');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async (id: string) => {
    if (!feishuUserId) {
      message.error('未绑定飞书用户ID，请联系管理员');
      return;
    }
    setSubmittingId(id);
    try {
      await submitPurchaseOrder(id, {
        feishuUserId,
        approvalDefCode: FEISHU_APPROVAL_DEF_CODE,
      });
      message.success('已提交审批');
      loadData();
    } catch {
      message.error('提交审批失败');
    } finally {
      setSubmittingId(null);
    }
  };

  const openReceive = (record: any) => {
    setReceivingId(record.id);
    setReceivingItems(record.items || []);
    receiveForm.setFieldsValue({
      items: (record.items || []).map((i: any) => ({
        itemId: i.id,
        receiveQty: Number(i.qty) - Number(i.receivedQty || 0),
      })),
    });
    setReceiveModalOpen(true);
  };

  const handleReceive = async (values: any) => {
    if (!receivingId) return;
    try {
      await receivePurchaseOrder(receivingId, { items: values.items });
      message.success('到货入库成功');
      setReceiveModalOpen(false);
      loadData();
    } catch {
      message.error('到货入库失败');
    }
  };

  // 合并商品列表与订单中已存在但可能不在列表里的商品
  const productOptionMap = new Map<string, string>();
  products.forEach((p) => productOptionMap.set(p.id, p.name));

  const columns = [
    { title: '采购单号', dataIndex: 'orderNo', key: 'orderNo', width: 160, fixed: 'left' as const },
    {
      title: '供应商',
      key: 'supplier',
      width: 140,
      render: (_: any, record: any) => record.supplierName || record.supplier?.name || '-',
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
      title: '采购金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      align: 'right' as const,
      render: (v: number) => `¥${Number(v || 0).toFixed(2)}`,
    },
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 160, ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small" style={{ minHeight: 24 }}>
          {record.status === 'draft' && hasPermission('purchase_order:edit') && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          )}
          {record.status === 'draft' && hasPermission('purchase_order:submit') && (
            <Button
              type="link"
              size="small"
              icon={<SendOutlined />}
              loading={submittingId === record.id}
              onClick={() => handleSubmit(record.id)}
            >
              提交审批
            </Button>
          )}
          {(record.status === 'approved' || record.status === 'partial_received') && hasPermission('purchase_order:receive') && (
            <Button type="link" size="small" icon={<InboxOutlined />} onClick={() => openReceive(record)}>到货入库</Button>
          )}
          {record.status === 'draft' && hasPermission('purchase_order:delete') && (
            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const tableHeaderStyle: React.CSSProperties = {
    display: 'flex',
    fontWeight: 500,
    fontSize: 13,
    color: '#A0A0A0',
    padding: '8px 4px',
    borderBottom: '1px solid #F0E6FF',
    marginBottom: 8,
  };

  const tableRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 0',
  };

  const colStyle = (width: number): React.CSSProperties => ({
    width,
    flexShrink: 0,
  });

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="采购单管理">
        {hasPermission('purchase_order:create') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建采购单</Button>
        )}
      </PageHeader>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索单号/供应商"
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
          options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.text }))}
        />
        <Select
          placeholder="供应商"
          value={supplierFilter || undefined}
          onChange={(v) => setSupplierFilter(v)}
          style={{ width: 160 }}
          allowClear
          showSearch
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
        />
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); loadData(p, ps); },
        }}
        scroll={{ x: 740 }}
        style={{ width: '100%' }}
      />

      {/* 新建/编辑弹窗 */}
      <Modal
        title={editingId ? '编辑采购单' : '新建采购单'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        width={960}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Form.Item name="supplierId" label="供应商" rules={[{ required: true, message: '请选择供应商' }]}>
            <Select
              placeholder="选择供应商"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="备注" />
          </Form.Item>

          <Divider>采购明细</Divider>
          <Form.List name="items" rules={[{ validator: async (_, value) => {
            if (!value || value.length === 0) throw new Error('请至少添加一项采购明细');
          }}]}>
            {(fields, { add, remove }) => (
              <div>
                {/* 表头 */}
                <div style={tableHeaderStyle}>
                  <div style={colStyle(200)}>商品</div>
                  <div style={colStyle(180)}>规格型号</div>
                  <div style={colStyle(70)}>数量</div>
                  <div style={colStyle(90)}>单价</div>
                  <div style={colStyle(90)}>小计</div>
                  <div style={colStyle(80)}>备注</div>
                  <div style={colStyle(50)}></div>
                </div>

                {/* 数据行 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {fields.map(({ key, name, ...restField }) => (
                    <div key={key} style={tableRowStyle}>
                      <div style={colStyle(200)}>
                        <Form.Item
                          {...restField}
                          name={[name, 'productId']}
                          rules={[{ required: true, message: '选商品' }]}
                          noStyle
                        >
                          <Select
                            placeholder="选择商品"
                            showSearch
                            filterOption={filterOption}
                            dropdownMatchSelectWidth={false}
                            style={{ width: '100%' }}
                            options={Array.from(productOptionMap.entries()).map(
                              ([value, label]) => ({ label, value }),
                            )}
                            onChange={(v) => handleProductChange(v, name)}
                          />
                        </Form.Item>
                      </div>
                      <div style={colStyle(180)}>
                        <Form.Item
                          {...restField}
                          name={[name, 'skuId']}
                          rules={[{ required: true, message: '选SKU' }]}
                          noStyle
                        >
                          <Select
                            placeholder="选择规格型号"
                            showSearch
                            filterOption={filterOption}
                            dropdownMatchSelectWidth={false}
                            style={{ width: '100%' }}
                            options={(() => {
                              const currentSkus = skuMap[name] || [];
                              const opts = currentSkus.map((s: any) => ({
                                label: s.skuName || s.skuCode || s.jstSkuId || s.id,
                                value: s.id,
                              }));
                              return opts;
                            })()}
                          />
                        </Form.Item>
                      </div>
                      <div style={colStyle(70)}>
                        <Form.Item
                          {...restField}
                          name={[name, 'qty']}
                          rules={[{ required: true, message: '数量' }]}
                          noStyle
                        >
                          <InputNumber
                            placeholder="数量"
                            min={0.0001}
                            step={0.01}
                            style={{ width: '100%' }}
                            onChange={() => recalcLineAmount(name)}
                          />
                        </Form.Item>
                      </div>
                      <div style={colStyle(90)}>
                        <Form.Item
                          {...restField}
                          name={[name, 'unitPrice']}
                          rules={[{ required: true, message: '单价' }]}
                          noStyle
                        >
                          <InputNumber
                            placeholder="单价"
                            min={0}
                            step={0.01}
                            prefix="¥"
                            style={{ width: '100%' }}
                            onChange={() => recalcLineAmount(name)}
                          />
                        </Form.Item>
                      </div>
                      <div style={colStyle(90)}>
                        <Form.Item
                          {...restField}
                          name={[name, 'lineAmount']}
                          noStyle
                        >
                          <InputNumber
                            placeholder="小计"
                            readOnly
                            precision={2}
                            prefix="¥"
                            style={{
                              width: '100%',
                              background: '#FFF8E7',
                            }}
                          />
                        </Form.Item>
                      </div>
                      <div style={colStyle(80)}>
                        <Form.Item
                          {...restField}
                          name={[name, 'remark']}
                          noStyle
                        >
                          <Input placeholder="备注" style={{ width: '100%' }} />
                        </Form.Item>
                      </div>
                      <div style={colStyle(50)}>
                        <Button
                          type="link"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(name)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="dashed"
                  onClick={() => add({ productIndex: fields.length })}
                  block
                  style={{ marginTop: 12 }}
                >
                  + 添加采购项
                </Button>
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* 到货弹窗 */}
      <Modal
        title="到货入库"
        open={receiveModalOpen}
        onCancel={() => setReceiveModalOpen(false)}
        onOk={() => receiveForm.submit()}
        destroyOnClose
      >
        <Form form={receiveForm} layout="vertical" onFinish={handleReceive} style={{ marginTop: 16 }}>
          <Form.List name="items">
            {(fields) => (
              <div>
                {fields.map(({ key, name, ...restField }) => {
                  const item = receivingItems[name];
                  const remaining = Number(item?.qty || 0) - Number(item?.receivedQty || 0);
                  return (
                    <Card key={key} size="small" style={{ marginBottom: 8 }}>
                      <div style={{ marginBottom: 8, fontWeight: 500 }}>
                        {item?.skuName || item?.skuCode || item?.skuId}
                      </div>
                      <div style={{ color: '#666', fontSize: 12, marginBottom: 8 }}>
                        采购: {item?.qty} | 已到货: {item?.receivedQty || 0} | 剩余: {remaining}
                      </div>
                      <Form.Item
                        {...restField}
                        name={[name, 'receiveQty']}
                        label="本次到货数量"
                        rules={[{ required: true, message: '请输入到货数量' }]}
                      >
                        <InputNumber min={0} max={remaining} step={0.01} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'itemId']} hidden>
                        <Input />
                      </Form.Item>
                    </Card>
                  );
                })}
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
