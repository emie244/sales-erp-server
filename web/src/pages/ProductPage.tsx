import { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, message } from 'antd';
import { fetchProducts, createProduct } from '@/api/products';

export default function ProductPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchProducts();
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
      await createProduct(values);
      message.success('创建成功');
      setOpen(false);
      form.resetFields();
      loadData();
    } catch {
      message.error('创建失败');
    }
  };

  const columns = [
    { title: '商品名称', dataIndex: 'name', key: 'name' },
    { title: '分类', dataIndex: 'category', key: 'category' },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    { title: '描述', dataIndex: 'description', key: 'description' },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 16, fontWeight: 500 }}>商品列表</span>
        <Button type="primary" onClick={() => setOpen(true)}>+ 新建商品</Button>
      </Space>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} />
      <Modal title="新建商品" open={open} onCancel={() => setOpen(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="商品名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="请输入商品名称" />
          </Form.Item>
          <Form.Item label="分类" name="category">
            <Input placeholder="请输入分类" />
          </Form.Item>
          <Form.Item label="单位" name="unit">
            <Input placeholder="件/个/套..." />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea placeholder="请输入商品描述" rows={3} />
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
