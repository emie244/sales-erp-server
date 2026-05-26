import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import {
  fetchPurchaseRequests,
  createPurchaseRequest,
  updatePurchaseRequest,
  deletePurchaseRequest,
  convertPurchaseRequestToPo,
} from '@/api/purchase-requests';
import PageHeader from '@/components/PageHeader';
import { hasPermission } from '@/utils/permissions';
import type { PurchaseRequest } from '@/api/purchase-requests';

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  pending_approval: { label: '待审批', color: 'blue' },
  approved: { label: '已批准', color: 'green' },
  rejected: { label: '已驳回', color: 'red' },
  converted: { label: '已转采购单', color: 'purple' },
  cancelled: { label: '已取消', color: 'gray' },
};

export default function PurchaseRequestPage() {
  const location = useLocation();
  const [data, setData] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseRequest | null>(null);
  const [form] = Form.useForm();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  // 从销售订单跳转过来时预填数据
  useEffect(() => {
    const state = location.state as {
      fromOrderId?: string;
      items?: { skuId: string; skuName: string; qty: number }[];
    } | null;
    if (state?.items?.length && !open && !editing) {
      form.setFieldsValue({
        items: state.items.map((it) => ({
          ...it,
          qty: Number(it.qty),
        })),
      });
      setOpen(true);
      // 清除 state 避免刷新后重复
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const res = await fetchPurchaseRequests({
        status: statusFilter || undefined,
        page: p,
        pageSize: ps,
      });
      setData(res.data);
      setTotal(res.total);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page, pageSize]);

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        items: (values.items || []).map((it: any) => ({
          ...it,
          qty: Number(it.qty),
          estimatedUnitPrice: it.estimatedUnitPrice
            ? Number(it.estimatedUnitPrice)
            : undefined,
        })),
      };
      if (editing) {
        await updatePurchaseRequest(editing.id, payload);
        message.success('更新成功');
      } else {
        await createPurchaseRequest(payload);
        message.success('创建成功');
      }
      setOpen(false);
      form.resetFields();
      setEditing(null);
      loadData();
    } catch {
      message.error(editing ? '更新失败' : '创建失败');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，是否继续？',
      onOk: async () => {
        try {
          await deletePurchaseRequest(id);
          message.success('删除成功');
          loadData();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleConvert = async (id: string) => {
    setConvertingId(id);
    try {
      const res = await convertPurchaseRequestToPo(id);
      message.success(`已转采购单，PO ID: ${res.poIds.join(', ')}`);
      loadData();
    } catch (err: any) {
      message.error(err?.message || '转换失败');
    } finally {
      setConvertingId(null);
    }
  };

  const columns = [
    { title: 'PR编号', dataIndex: 'prNo', key: 'prNo', width: 140 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const s = statusMap[v] || { label: v, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: 'SKU数量',
      key: 'skuCount',
      width: 80,
      render: (_: any, record: PurchaseRequest) => record.items?.length || 0,
    },
    {
      title: '预估金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (v: number) => `¥${(v || 0).toFixed(2)}`,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: PurchaseRequest) => (
        <Space size="small">
          {record.status === 'draft' && hasPermission('purchase_request:edit') && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(record);
                form.setFieldsValue({
                  remark: record.remark,
                  items: record.items?.map((it) => ({
                    ...it,
                    qty: Number(it.qty),
                  })),
                });
                setOpen(true);
              }}
            >
              编辑
            </Button>
          )}
          {record.status === 'approved' &&
            hasPermission('purchase_request:convert') && (
              <Button
                type="link"
                size="small"
                icon={<ShoppingCartOutlined />}
                loading={convertingId === record.id}
                onClick={() => handleConvert(record.id)}
              >
                转采购单
              </Button>
            )}
          {record.status === 'draft' &&
            hasPermission('purchase_request:delete') && (
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record.id)}
              >
                删除
              </Button>
            )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="采购申请">
        {hasPermission('purchase_request:create') && (
          <Button
            type="primary"
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
          >
            <PlusOutlined /> 新建采购申请
          </Button>
        )}
      </PageHeader>

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="全部状态"
          value={statusFilter || undefined}
          onChange={setStatusFilter}
          style={{ width: 140 }}
          allowClear
        >
          <Select.Option value="draft">草稿</Select.Option>
          <Select.Option value="pending_approval">待审批</Select.Option>
          <Select.Option value="approved">已批准</Select.Option>
          <Select.Option value="rejected">已驳回</Select.Option>
          <Select.Option value="converted">已转采购单</Select.Option>
        </Select>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title={editing ? '编辑采购申请' : '新建采购申请'}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>

          <Form.Item label="明细" required>
            <Form.List name="items" initialValue={[{}]}>
              {(fields, { add, remove }) => (
                <div>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space
                      key={key}
                      style={{ display: 'flex', marginBottom: 8 }}
                      align="baseline"
                    >
                      <Form.Item
                        {...restField}
                        name={[name, 'skuId']}
                        rules={[{ required: true, message: 'SKU ID' }]}
                      >
                        <Input placeholder="SKU ID" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'skuName']}
                      >
                        <Input placeholder="SKU名称" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'qty']}
                        rules={[{ required: true, message: '数量' }]}
                      >
                        <InputNumber
                          placeholder="数量"
                          min={0.0001}
                          style={{ width: 100 }}
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'estimatedUnitPrice']}
                      >
                        <InputNumber
                          placeholder="预估单价"
                          min={0}
                          prefix="¥"
                          style={{ width: 120 }}
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'supplierName']}
                      >
                        <Input placeholder="供应商" style={{ width: 120 }} />
                      </Form.Item>
                      <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                      />
                    </Space>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    添加明细
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button
                onClick={() => {
                  setOpen(false);
                  setEditing(null);
                }}
              >
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
