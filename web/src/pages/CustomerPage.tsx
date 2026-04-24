import { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Tag } from 'antd';
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '@/api/customers';

export default function CustomerPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchCustomers({ page: 1, pageSize: 100 });
      setData(res.data);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (values: any) => {
    try {
      if (editingId) {
        await updateCustomer(editingId, values);
        message.success('更新成功');
      } else {
        await createCustomer(values);
        message.success('创建成功');
      }
      setOpen(false);
      setEditingId(null);
      form.resetFields();
      loadData();
    } catch {
      message.error(editingId ? '更新失败' : '创建失败');
    }
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setOpen(true);
  };

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    setOpen(true);
  };

  const handleDelete = (record: any) => {
    Modal.confirm({
      title: '确认删除客户',
      content: `确定要删除客户「${record.name}」吗？删除后该客户将不在列表中显示。`,
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteCustomer(record.id);
          message.success('删除成功');
          loadData();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const columns = [
    { title: '客户名称', dataIndex: 'name', key: 'name' },
    { title: '联系人', dataIndex: 'contactName', key: 'contactName' },
    { title: '电话', dataIndex: 'phone', key: 'phone' },
    { title: '等级', dataIndex: 'level', key: 'level' },
    {
      title: '预收款余额',
      dataIndex: 'prepaymentBalance',
      key: 'prepaymentBalance',
      align: 'right' as const,
      render: (v: number) => `¥${parseFloat(v?.toString() || '0').toFixed(2)}`,
    },
    { title: '地址', dataIndex: 'address', key: 'address' },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (v: boolean) =>
        v !== false ? <Tag color="green">启用</Tag> : <Tag color="red">已删除</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.isActive !== false && (
            <Button type="link" danger onClick={() => handleDelete(record)}>
              删除
            </Button>
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
        <span style={{ fontSize: 16, fontWeight: 500 }}>客户列表</span>
        <Button type="primary" onClick={handleCreate}>
          + 新建客户
        </Button>
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
      />
      <Modal
        title={editingId ? '编辑客户' : '新建客户'}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditingId(null);
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="客户名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="请输入客户名称" />
          </Form.Item>
          <Form.Item label="联系人" name="contactName">
            <Input placeholder="请输入联系人" />
          </Form.Item>
          <Form.Item label="电话" name="phone">
            <Input placeholder="请输入电话" />
          </Form.Item>
          <Form.Item label="客户等级" name="level">
            <Input placeholder="A/B/C" />
          </Form.Item>
          <Form.Item label="信用额度" name="creditLimit">
            <Input placeholder="请输入信用额度" />
          </Form.Item>
          <Form.Item label="账期(天)" name="paymentTerms">
            <Input placeholder="请输入账期天数" />
          </Form.Item>
          <Form.Item label="地址" name="address">
            <Input placeholder="请输入地址" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setOpen(false);
                  setEditingId(null);
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
