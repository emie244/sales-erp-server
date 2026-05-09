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
import { fetchAllSkus } from '@/api/products';
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

export default function PurchaseOrderPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [skus, setSkus] = useState<any[]>([]);
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

  const loadSkus = async () => {
    try {
      const res = await fetchAllSkus({ pageSize: 9999 });
      setSkus(res.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadData();
    loadSuppliers();
    loadSkus();
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
    setModalOpen(true);
  };

  const openEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      supplierId: record.supplierId,
      remark: record.remark,
      items: (record.items || []).map((i: any) => ({
        skuId: i.skuId,
        qty: i.qty,
        unitPrice: i.unitPrice,
        remark: i.remark,
      })),
    });
    setModalOpen(true);
  };

  const handleSave = async (values: any) => {
    try {
      const payload = {
        ...values,
        items: values.items.map((item: any) => {
          const sku = skus.find((s: any) => (s.jstSkuId || s.id) === item.skuId);
          return {
            ...item,
            skuCode: sku?.skuCode || '',
            skuName: sku?.skuName || sku?.product?.name || sku?.propertiesValue || sku?.skuCode || item.skuId,
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
        width={720}
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
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={[name, 'skuId']}
                      rules={[{ required: true, message: '请选择SKU' }]}
                      style={{ minWidth: 200 }}
                    >
                      <Select
                        placeholder="选择SKU"
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={skus.map((s) => ({
                          value: s.jstSkuId || s.id,
                          label: `${s.skuName || s.product?.name || s.propertiesValue || s.skuCode || s.id}`,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'qty']}
                      rules={[{ required: true, message: '请输入数量' }]}
                    >
                      <InputNumber placeholder="数量" min={0.0001} step={0.01} style={{ width: 100 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'unitPrice']}
                      rules={[{ required: true, message: '请输入单价' }]}
                    >
                      <InputNumber placeholder="单价" min={0} step={0.01} prefix="¥" style={{ width: 110 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'remark']}
                    >
                      <Input placeholder="备注" style={{ width: 120 }} />
                    </Form.Item>
                    <Button type="link" danger onClick={() => remove(name)}>删除</Button>
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} block>+ 添加采购项</Button>
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
