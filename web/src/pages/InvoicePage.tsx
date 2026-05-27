import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  message,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons';
import {
  fetchInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
} from '@/api/invoices';
import PageHeader from '@/components/PageHeader';
import { hasPermission } from '@/utils/permissions';
import type { InvoiceRecord } from '@/api/invoices';
import dayjs from 'dayjs';

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  issued: { label: '已开具', color: 'green' },
  cancelled: { label: '已作废', color: 'red' },
};

export default function InvoicePage() {
  const [data, setData] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceRecord | null>(null);
  const [form] = Form.useForm();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const loadData = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const res = await fetchInvoices({
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
        amount: Number(values.amount),
        invoiceDate: values.invoiceDate
          ? values.invoiceDate.format('YYYY-MM-DD')
          : undefined,
      };
      if (editing) {
        await updateInvoice(editing.id, payload);
        message.success('更新成功');
      } else {
        await createInvoice(payload);
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
          await deleteInvoice(id);
          message.success('删除成功');
          loadData();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const columns = [
    { title: '发票号码', dataIndex: 'invoiceNo', key: 'invoiceNo', width: 160 },
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
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (v: number) => `¥${(v || 0).toFixed(2)}`,
    },
    {
      title: '开票日期',
      dataIndex: 'invoiceDate',
      key: 'invoiceDate',
      width: 120,
      render: (v: string) => (v ? new Date(v).toLocaleDateString('zh-CN') : '-'),
    },
    {
      title: '关联订单',
      dataIndex: 'salesOrderId',
      key: 'salesOrderId',
      width: 200,
      render: (v: string | null) => v || '-',
    },
    {
      title: '开票人',
      dataIndex: 'issuer',
      key: 'issuer',
      render: (v: string) => v || '-',
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right' as const,
      render: (_: any, record: InvoiceRecord) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(record);
              form.setFieldsValue({
                ...record,
                invoiceDate: record.invoiceDate
                  ? dayjs(record.invoiceDate)
                  : undefined,
              });
              setOpen(true);
            }}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="发票管理">
        {hasPermission('invoice:create') && (
          <Button
            type="primary"
            onClick={() => {
              setEditing(null);
              form.resetFields();
              setOpen(true);
            }}
          >
            <PlusOutlined /> 新建发票
          </Button>
        )}
      </PageHeader>

      <Space style={{ marginBottom: 16, flexShrink: 0 }}>
        <Select
          placeholder="全部状态"
          value={statusFilter || undefined}
          onChange={setStatusFilter}
          style={{ width: 140 }}
          allowClear
        >
          <Select.Option value="draft">草稿</Select.Option>
          <Select.Option value="issued">已开具</Select.Option>
          <Select.Option value="cancelled">已作废</Select.Option>
        </Select>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        sticky
        scroll={{ x: 900, y: 'calc(100vh - 360px)' }}
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
        title={editing ? '编辑发票' : '新建发票'}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="发票号码"
            name="invoiceNo"
            rules={[{ required: true, message: '请输入发票号码' }]}
          >
            <Input placeholder="发票号码" />
          </Form.Item>

          <Form.Item
            label="金额"
            name="amount"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber
              prefix="¥"
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="金额"
            />
          </Form.Item>

          <Form.Item
            label="开票日期"
            name="invoiceDate"
            rules={[{ required: true, message: '请选择开票日期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="开票日期" />
          </Form.Item>

          <Form.Item label="关联销售订单" name="salesOrderId">
            <Input placeholder="销售订单 ID（可选）" />
          </Form.Item>

          <Form.Item label="状态" name="status" initialValue="draft">
            <Select placeholder="状态">
              <Select.Option value="draft">草稿</Select.Option>
              <Select.Option value="issued">已开具</Select.Option>
              <Select.Option value="cancelled">已作废</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="开票人" name="issuer">
            <Input placeholder="开票人" />
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} placeholder="备注" />
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
