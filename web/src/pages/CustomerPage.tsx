import { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, message } from 'antd';
import { fetchCustomers, createCustomer } from '@/api/customers';

export default function CustomerPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchCustomers();
      setData(res);
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
      await createCustomer(values);
      message.success('创建成功');
      setOpen(false);
      form.resetFields();
      loadData();
    } catch {
      message.error('创建失败');
    }
  };

  const columns = [
    { title: '客户名称', dataIndex: 'name', key: 'name' },
    { title: '联系人', dataIndex: 'contactName', key: 'contactName' },
    { title: '电话', dataIndex: 'phone', key: 'phone' },
    { title: '等级', dataIndex: 'level', key: 'level' },
    { title: '地址', dataIndex: 'address', key: 'address' },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 16, fontWeight: 500 }}>客户列表</span>
        <Button type="primary" onClick={() => setOpen(true)}>+ 新建客户</Button>
      </Space>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} />
      <Modal title="新建客户" open={open} onCancel={() => setOpen(false)} footer={null} destroyOnClose>
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
              <Button onClick={() => setOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">保存</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
