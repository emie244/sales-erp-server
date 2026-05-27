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
  MinusCircleOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  fetchVouchers,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  postVoucher,
  cancelVoucher,
} from '@/api/vouchers';
import PageHeader from '@/components/PageHeader';
import { hasPermission } from '@/utils/permissions';
import type { Voucher } from '@/api/vouchers';
import dayjs from 'dayjs';

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  posted: { label: '已过账', color: 'green' },
  cancelled: { label: '已作废', color: 'red' },
};

const typeMap: Record<string, string> = {
  receivable: '应收',
  receipt: '收款',
  payment: '付款',
  payable: '应付',
  adjustment: '调整',
};

export default function VoucherPage() {
  const [data, setData] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [form] = Form.useForm();
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('');
  const [sourceIdFilter, setSourceIdFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const loadData = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const res = await fetchVouchers({
        status: statusFilter || undefined,
        sourceType: sourceTypeFilter || undefined,
        sourceId: sourceIdFilter || undefined,
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
  }, [statusFilter, sourceTypeFilter, sourceIdFilter, page, pageSize]);

  const handleSubmit = async (values: any) => {
    try {
      const items = (values.items || []).map((it: any) => ({
        ...it,
        debitAmount: Number(it.debitAmount || 0),
        creditAmount: Number(it.creditAmount || 0),
      }));

      const totalDebit = items.reduce((sum: number, it: any) => sum + (it.debitAmount || 0), 0);
      const totalCredit = items.reduce((sum: number, it: any) => sum + (it.creditAmount || 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        message.error('借方总额必须等于贷方总额');
        return;
      }

      const payload = {
        ...values,
        totalAmount: totalDebit,
        voucherDate: values.voucherDate ? values.voucherDate.format('YYYY-MM-DD') : undefined,
        items,
      };
      if (editing) {
        await updateVoucher(editing.id, payload);
        message.success('更新成功');
      } else {
        await createVoucher(payload);
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
          await deleteVoucher(id);
          message.success('删除成功');
          loadData();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handlePost = async (id: string) => {
    try {
      await postVoucher(id);
      message.success('过账成功');
      loadData();
    } catch (err: any) {
      message.error(err?.message || '过账失败');
    }
  };

  const handleCancel = async (id: string) => {
    Modal.confirm({
      title: '确认作废',
      content: '作废后不可恢复，是否继续？',
      onOk: async () => {
        try {
          await cancelVoucher(id);
          message.success('作废成功');
          loadData();
        } catch (err: any) {
          message.error(err?.message || '作废失败');
        }
      },
    });
  };

  const columns = [
    { title: '凭证号', dataIndex: 'voucherNo', key: 'voucherNo', width: 160 },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (v: string) => typeMap[v] || v,
    },
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
      title: '总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (v: number) => `¥${(v || 0).toFixed(2)}`,
    },
    {
      title: '日期',
      dataIndex: 'voucherDate',
      key: 'voucherDate',
      width: 120,
      render: (v: string) => (v ? new Date(v).toLocaleDateString('zh-CN') : '-'),
    },
    {
      title: '摘要',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '来源单据',
      key: 'source',
      width: 180,
      render: (_: any, record: Voucher) => {
        if (!record.sourceType || !record.sourceId) return '-';
        const labelMap: Record<string, string> = {
          sales_order: '销售订单',
          purchase_order: '采购单',
          production_order: '加工单',
        };
        return (
          <Tag color="blue">
            {labelMap[record.sourceType] || record.sourceType}: {record.sourceId.slice(0, 8)}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right' as const,
      render: (_: any, record: Voucher) => (
        <Space size="small">
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handlePost(record.id)}
            >
              过账
            </Button>
          )}
          {record.status === 'posted' && (
            <Button
              type="link"
              danger
              size="small"
              icon={<StopOutlined />}
              onClick={() => handleCancel(record.id)}
            >
              作废
            </Button>
          )}
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(record);
                form.setFieldsValue({
                  ...record,
                  voucherDate: record.voucherDate ? dayjs(record.voucherDate) : undefined,
                  items: record.items?.map((it) => ({
                    ...it,
                    debitAmount: Number(it.debitAmount),
                    creditAmount: Number(it.creditAmount),
                  })) || [{}],
                });
                setOpen(true);
              }}
            >
              编辑
            </Button>
          )}
          {record.status === 'draft' && (
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
    <div style={{ width: '100%', height: 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="会计凭证">
        {hasPermission('voucher:create') && (
          <Button
            type="primary"
            onClick={() => {
              setEditing(null);
              form.resetFields();
              form.setFieldsValue({ items: [{}] });
              setOpen(true);
            }}
          >
            <PlusOutlined /> 新建凭证
          </Button>
        )}
      </PageHeader>

      <Space style={{ marginBottom: 16, flexShrink: 0 }} wrap>
        <Select
          placeholder="全部状态"
          value={statusFilter || undefined}
          onChange={setStatusFilter}
          style={{ width: 140 }}
          allowClear
        >
          <Select.Option value="draft">草稿</Select.Option>
          <Select.Option value="posted">已过账</Select.Option>
          <Select.Option value="cancelled">已作废</Select.Option>
        </Select>
        <Select
          placeholder="来源类型"
          value={sourceTypeFilter || undefined}
          onChange={setSourceTypeFilter}
          style={{ width: 140 }}
          allowClear
        >
          <Select.Option value="sales_order">销售订单</Select.Option>
          <Select.Option value="purchase_order">采购单</Select.Option>
          <Select.Option value="production_order">加工单</Select.Option>
        </Select>
        <Input
          placeholder="来源单据ID"
          value={sourceIdFilter}
          onChange={(e) => setSourceIdFilter(e.target.value)}
          style={{ width: 200 }}
          allowClear
        />
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        sticky
        scroll={{ x: 900, y: 'calc(100vh - 360px)' }}
        onChange={(pagination) => {
          setPage(pagination.current || 1);
          setPageSize(pagination.pageSize || 20);
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
        }}
      />

      <Modal
        title={editing ? '编辑凭证' : '新建凭证'}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={880}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="凭证日期"
            name="voucherDate"
            rules={[{ required: true, message: '请选择凭证日期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="凭证日期" />
          </Form.Item>

          <Form.Item label="类型" name="type" initialValue="adjustment">
            <Select placeholder="类型">
              <Select.Option value="receivable">应收</Select.Option>
              <Select.Option value="receipt">收款</Select.Option>
              <Select.Option value="payment">付款</Select.Option>
              <Select.Option value="adjustment">调整</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="摘要" name="description">
            <Input.TextArea rows={2} placeholder="摘要" />
          </Form.Item>

          <Form.Item label="凭证明细" required>
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
                        name={[name, 'accountCode']}
                        rules={[{ required: true, message: '科目' }]}
                      >
                        <Input placeholder="科目代码" style={{ width: 120 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'accountName']}>
                        <Input placeholder="科目名称" style={{ width: 140 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'debitAmount']}>
                        <InputNumber
                          placeholder="借方"
                          min={0}
                          precision={2}
                          prefix="¥"
                          style={{ width: 120 }}
                        />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'creditAmount']}>
                        <InputNumber
                          placeholder="贷方"
                          min={0}
                          precision={2}
                          prefix="¥"
                          style={{ width: 120 }}
                        />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'description']}>
                        <Input placeholder="摘要" style={{ width: 140 }} />
                      </Form.Item>
                      <Button
                        type="link"
                        danger
                        icon={<MinusCircleOutlined />}
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
