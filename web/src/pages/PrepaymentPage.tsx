import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  message,
  Modal,
  Form,
  DatePicker,
  InputNumber,
  Upload,
  Tag,
} from 'antd';
import dayjs from 'dayjs';
import { UploadOutlined } from '@ant-design/icons';
import {
  fetchPrepayments,
  createPrepayment,
  updatePrepayment,
  deletePrepayment,
  submitPrepaymentForApproval,
} from '@/api/prepayments';
import { fetchCustomers } from '@/api/customers';
import { fetchUserProfile } from '@/api/users';
import { FEISHU_PREPAYMENT_APPROVAL_DEF_CODE } from '@/config';
import type { PrepaymentRecord, Customer } from '@/types';
import axios from '@/api/axios';
import { formatDateTime } from '@/utils/datetime';
import PageHeader from '@/components/PageHeader';
import { hasPermission } from '@/utils/permissions';

export default function PrepaymentPage() {
  const [data, setData] = useState<PrepaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [feishuUserId, setFeishuUserId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [editingRecord, setEditingRecord] = useState<PrepaymentRecord | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchPrepayments();
      setData(res);
      setTotal(res.length);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await fetchCustomers({ page: 1, pageSize: 100 });
      setCustomers(res.data);
    } catch {
      message.error('加载客户列表失败');
    }
  };

  useEffect(() => {
    loadData();
    loadCustomers();
    const cached = localStorage.getItem('erp_feishu_user_id');
    if (cached) {
      setFeishuUserId(cached);
      return;
    }
    const username = localStorage.getItem('erp_username');
    if (username) {
      fetchUserProfile(username)
        .then((profile) => {
          if (profile.feishuUserId) {
            localStorage.setItem('erp_feishu_user_id', profile.feishuUserId);
            localStorage.setItem('erp_feishu_user_id_type', 'user_id');
            setFeishuUserId(profile.feishuUserId);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleCreate = async (values: any) => {
    setSubmitting(true);
    try {
      await createPrepayment({
        ...values,
        paymentDate: values.paymentDate?.format('YYYY-MM-DD'),
        receiptUrl,
      });
      message.success('创建成功');
      setModalOpen(false);
      form.resetFields();
      setReceiptUrl('');
      loadData();
    } catch {
      message.error('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (values: any) => {
    if (!editingRecord) return;
    setSubmitting(true);
    try {
      await updatePrepayment(editingRecord.id, {
        ...values,
        paymentDate: values.paymentDate?.format('YYYY-MM-DD'),
        receiptUrl,
      });
      message.success('更新成功');
      setModalOpen(false);
      setEditingRecord(null);
      form.resetFields();
      setReceiptUrl('');
      loadData();
    } catch {
      message.error('更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (record: PrepaymentRecord) => {
    const userId = feishuUserId || localStorage.getItem('erp_feishu_user_id');
    const userIdType =
      localStorage.getItem('erp_feishu_user_id_type') || 'user_id';
    if (!userId || userIdType !== 'user_id') {
      message.error('当前账号未绑定飞书 User ID，请联系管理员补充');
      return;
    }
    setSubmittingId(record.id);
    try {
      await submitPrepaymentForApproval(record.id, {
        feishuUserId: userId,
        feishuUserIdType: userIdType,
        approvalDefCode: FEISHU_PREPAYMENT_APPROVAL_DEF_CODE,
      });
      message.success('提交审批成功');
      loadData();
    } catch (err: any) {
      message.error(err?.message || '提交失败');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，是否继续？',
      onOk: async () => {
        try {
          await deletePrepayment(id);
          message.success('删除成功');
          loadData();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleEdit = (record: PrepaymentRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      customerId: record.customerId,
      amount: record.amount,
      paymentMethod: record.paymentMethod,
      paymentDate: record.paymentDate ? dayjs(record.paymentDate) : null,
      remark: record.remark,
    });
    setReceiptUrl(record.receiptUrl || '');
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingRecord(null);
    form.resetFields();
    setReceiptUrl('');
  };

  const getStatusTag = (record: PrepaymentRecord) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      pending: record.approvalInstanceCode
        ? { label: '审批中', color: 'gold' }
        : { label: '待提交', color: 'default' },
      approved: { label: '已通过', color: 'success' },
      rejected: { label: '已拒绝', color: 'error' },
    };
    const s = statusMap[record.status] || { label: record.status, color: 'default' };
    return <Tag color={s.color}>{s.label}</Tag>;
  };

  const columns = [
    {
      title: '客户',
      key: 'customer',
      width: 140,
      ellipsis: true,
      render: (_: any, record: PrepaymentRecord) =>
        record.customer?.name || '-',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 110,
      align: 'right' as const,
      render: (v: number) => `¥${parseFloat(v?.toString() || '0').toFixed(2)}`,
    },
    {
      title: '支付方式',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 100,
      render: (v: string) => v || '-',
    },
    {
      title: '支付日期',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 110,
    },
    {
      title: '收款凭证',
      dataIndex: 'receiptUrl',
      key: 'receiptUrl',
      width: 90,
      render: (v: string) =>
        v ? (
          <a href={v} target="_blank" rel="noreferrer">
            查看
          </a>
        ) : (
          '-'
        ),
    },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render: (_: any, record: PrepaymentRecord) => getStatusTag(record),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: PrepaymentRecord) => (
        <Space size={4} style={{ minHeight: 24 }}>
          {record.status === 'pending' && !record.approvalInstanceCode && (
            <>
              <Button
                type="link"
                size="small"
                loading={submittingId === record.id}
                disabled={submittingId === record.id}
                onClick={() => handleSubmit(record)}
              >
                提交审批
              </Button>
              <Button
                type="link"
                size="small"
                danger
                onClick={() => handleDelete(record.id)}
              >
                删除
              </Button>
            </>
          )}
          {record.status === 'rejected' && hasPermission('prepayment:edit') && (
            <>
              <Button type="link" size="small" onClick={() => handleEdit(record)}>
                编辑
              </Button>
              <Button
                type="link"
                size="small"
                loading={submittingId === record.id}
                disabled={submittingId === record.id}
                onClick={() => handleSubmit(record)}
              >
                重新提交
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="预付款管理">
        <Button type="primary" onClick={() => setModalOpen(true)}>
          + 新建预付款
        </Button>
      </PageHeader>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 970 }}
        style={{ width: '100%' }}
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
        title={editingRecord ? '编辑预付款' : '新建预付款'}
        open={modalOpen}
        onCancel={handleCloseModal}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingRecord ? handleUpdate : handleCreate}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="customerId"
            label="客户"
            rules={[{ required: true, message: '请选择客户' }]}
          >
            <Select placeholder="请选择客户">
              {customers.map((c) => (
                <Select.Option key={c.id} value={c.id}>
                  {c.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="amount"
            label="预付款金额"
            rules={[{ required: true, message: '请输入金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              precision={2}
              prefix="¥"
              placeholder="请输入预付款金额"
            />
          </Form.Item>
          <Form.Item
            name="paymentMethod"
            label="支付方式"
            rules={[{ required: true, message: '请选择支付方式' }]}
          >
            <Select placeholder="请选择支付方式">
              <Select.Option value="Jean-支付宝">Jean-支付宝</Select.Option>
              <Select.Option value="宝生银行-亿觅">宝生银行-亿觅</Select.Option>
              <Select.Option value="支付宝-Sue">支付宝-Sue</Select.Option>
              <Select.Option value="招商银行-亿觅(云城支行)">招商银行-亿觅(云城支行)</Select.Option>
              <Select.Option value="预收款项">预收款项</Select.Option>
              <Select.Option value="谭钦成-招行">谭钦成-招行</Select.Option>
              <Select.Option value="支付宝-亿觅acc">支付宝-亿觅acc</Select.Option>
              <Select.Option value="额度帐扣">额度帐扣</Select.Option>
              <Select.Option value="兴业银行-亿觅">兴业银行-亿觅</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="paymentDate"
            label="支付日期"
            rules={[{ required: true, message: '请选择支付日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="收款凭证"
            rules={[{ required: true, message: '请上传收款凭证' }]}
          >
            <Upload
              customRequest={async ({ file, onSuccess, onError, onProgress }) => {
                const formData = new FormData();
                const rawFile = (file as any).originFileObj || file;
                formData.append('file', rawFile);
                try {
                  const res = await axios.post('/uploads', formData, {
                    onUploadProgress: (e: any) => {
                      onProgress?.({ percent: Math.round((e.loaded / (e.total || 1)) * 100) });
                    },
                  });
                  const url = (res as any)?.url;
                  if (!url) {
                    throw new Error('上传接口未返回 URL');
                  }
                  setReceiptUrl(url);
                  onSuccess?.(res as any);
                  message.success('上传成功');
                } catch (err: any) {
                  message.error('上传失败：' + (err?.response?.data?.message || err.message));
                  onError?.(err);
                }
              }}
              fileList={
                receiptUrl
                  ? [
                      {
                        uid: '-1',
                        name: '收款凭证',
                        status: 'done',
                        url: receiptUrl,
                      } as any,
                    ]
                  : []
              }
              onRemove={() => {
                setReceiptUrl('');
                return true;
              }}
              listType="picture"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>上传凭证</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
