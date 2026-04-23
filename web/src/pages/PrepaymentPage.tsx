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
} from 'antd';
import {
  fetchPrepayments,
  createPrepayment,
  deletePrepayment,
  submitPrepaymentForApproval,
} from '@/api/prepayments';
import { fetchCustomers } from '@/api/customers';
import { fetchUserProfile } from '@/api/users';
import { FEISHU_APPROVAL_DEF_CODE } from '@/config';
import type { PrepaymentRecord, Customer } from '@/types';

export default function PrepaymentPage() {
  const [data, setData] = useState<PrepaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [feishuUserId, setFeishuUserId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchPrepayments();
      setData(res);
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
      });
      message.success('创建成功');
      setModalOpen(false);
      form.resetFields();
      loadData();
    } catch {
      message.error('创建失败');
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
        approvalDefCode: FEISHU_APPROVAL_DEF_CODE,
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

  const columns = [
    {
      title: '客户',
      key: 'customer',
      render: (_: any, record: PrepaymentRecord) =>
        record.customer?.name || '-',
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number) => `¥${parseFloat(v?.toString() || '0').toFixed(2)}`,
      align: 'right' as const,
    },
    {
      title: '支付方式',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (v: string) => v || '-',
    },
    {
      title: '支付日期',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => {
        const map: Record<string, string> = {
          pending: '待审批',
          approved: '已通过',
          rejected: '已拒绝',
        };
        return map[v] || v;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => v?.replace('T', ' ').slice(0, 19),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: PrepaymentRecord) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                loading={submittingId === record.id}
                disabled={submittingId === record.id}
                onClick={() => handleSubmit(record)}
              >
                提交审批
              </Button>
              <Button
                type="link"
                danger
                onClick={() => handleDelete(record.id)}
              >
                删除
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <div />
        <Button type="primary" onClick={() => setModalOpen(true)}>
          + 新建预付款
        </Button>
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
      />
      <Modal
        title="新建预付款"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
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
          <Form.Item name="paymentMethod" label="支付方式">
            <Select placeholder="请选择支付方式" allowClear>
              <Select.Option value="bank_transfer">银行转账</Select.Option>
              <Select.Option value="alipay">支付宝</Select.Option>
              <Select.Option value="wechat">微信支付</Select.Option>
              <Select.Option value="cash">现金</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="paymentDate" label="支付日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
