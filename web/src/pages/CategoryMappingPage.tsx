import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Tag,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from '@/api/axios';
import PageHeader from '@/components/PageHeader';

interface CategoryMapping {
  id: string;
  erpCategory: string;
  jstCategory: string;
  jstCategoryId?: string;
  isActive: boolean;
}

export default function CategoryMappingPage() {
  const [data, setData] = useState<CategoryMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/category-mappings');
      setData(res.data || []);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (values: any) => {
    try {
      await axios.post('/category-mappings', values);
      message.success('保存成功');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`/category-mappings/${id}`);
      message.success('删除成功');
      load();
    } catch {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: 'ERP 分类',
      dataIndex: 'erpCategory',
      key: 'erpCategory',
    },
    {
      title: '聚水潭分类',
      dataIndex: 'jstCategory',
      key: 'jstCategory',
    },
    {
      title: '聚水潭分类 ID',
      dataIndex: 'jstCategoryId',
      key: 'jstCategoryId',
      render: (v?: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (v: boolean) =>
        v ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CategoryMapping) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record.id)}
        >
          删除
        </Button>
      ),
    },
  ];

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="分类映射管理">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            setModalOpen(true);
          }}
        >
          新增映射
        </Button>
      </PageHeader>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title="新增分类映射"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            label="ERP 分类"
            name="erpCategory"
            rules={[{ required: true }]}
          >
            <Input placeholder="如：数码" />
          </Form.Item>
          <Form.Item
            label="聚水潭分类"
            name="jstCategory"
            rules={[{ required: true }]}
          >
            <Input placeholder="如：3C数码" />
          </Form.Item>
          <Form.Item label="聚水潭分类 ID" name="jstCategoryId">
            <Input placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
