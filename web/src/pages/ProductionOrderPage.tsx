import { useState, useEffect } from 'react';
import {
  Table, Button, Space, Modal, Form, Select, message, Popconfirm,
  Tag, InputNumber, Divider, Input, Descriptions,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, CheckCircleOutlined, EyeOutlined, EditOutlined,
} from '@ant-design/icons';
import {
  fetchProductionOrders, createProductionOrder, updateProductionOrder,
  deleteProductionOrder, completeProductionOrder,
} from '@/api/production-orders';
import { fetchBoms } from '@/api/boms';
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
  const [boms, setBoms] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<any>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const loadData = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const res = await fetchProductionOrders({
        page: p, pageSize: ps, status: statusFilter,
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

  const loadBoms = async () => {
    try {
      const res = await fetchBoms({ pageSize: 9999 });
      setBoms(res.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadData();
    loadBoms();
  }, []);

  useEffect(() => {
    loadData(1);
    setPage(1);
  }, [statusFilter, keyword]);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue({
      bomId: record.bomId,
      qty: record.qty,
      remark: record.remark,
    });
    setModalOpen(true);
  };

  const handleSave = async (values: any) => {
    try {
      if (editingId) {
        await updateProductionOrder(editingId, values);
        message.success('更新成功');
      } else {
        await createProductionOrder(values);
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
    { title: '加工单号', dataIndex: 'orderNo', key: 'orderNo', width: 160, fixed: 'left' as const },
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
    { title: '备注', dataIndex: 'remark', key: 'remark', width: 160, ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small" style={{ minHeight: 24 }}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>详情</Button>
          {record.status === 'pending' && hasPermission('production_order:edit') && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          )}
          {(record.status === 'pending' || record.status === 'processing') && hasPermission('production_order:complete') && (
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
          {record.status === 'pending' && hasPermission('production_order:delete') && (
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
      <PageHeader title="加工入库">
        {hasPermission('production_order:create') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建加工单</Button>
        )}
      </PageHeader>
      <Space wrap style={{ marginBottom: 16 }}>
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
          options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.text }))}
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
        title={editingId ? '编辑加工单' : '新建加工单'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Form.Item name="bomId" label="BOM" rules={[{ required: true, message: '请选择BOM' }]}>
            <Select
              placeholder="选择BOM"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={boms.map((b) => ({
                value: b.id,
                label: `${b.skuName || b.skuId} (v${b.version || '1'})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="qty" label="计划加工数量" rules={[{ required: true, message: '请输入数量' }]}>
            <InputNumber min={0.0001} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="加工单详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={640}
      >
        {detailRecord && (
          <div style={{ marginTop: 16 }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="加工单号">{detailRecord.orderNo}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_MAP[detailRecord.status]?.color}>
                  {STATUS_MAP[detailRecord.status]?.text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="成品SKU">{detailRecord.skuName || detailRecord.skuId}</Descriptions.Item>
              <Descriptions.Item label="计划数量">{detailRecord.qty}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{detailRecord.remark || '-'}</Descriptions.Item>
            </Descriptions>
            <Divider>原材料消耗明细</Divider>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detailRecord.items || []}
              columns={[
                { title: '原材料SKU', dataIndex: 'materialSkuId', key: 'sku', render: (v: string, r: any) => r.materialSkuName || v },
                { title: '需求数量', dataIndex: 'requiredQty', key: 'requiredQty', align: 'right' as const },
                { title: '实际消耗', dataIndex: 'actualQty', key: 'actualQty', align: 'right' as const },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
