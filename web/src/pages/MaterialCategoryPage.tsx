import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  fetchMaterialCategories,
  createMaterialCategory,
  updateMaterialCategory,
  deleteMaterialCategory,
  type MaterialCategory,
} from '@/api/material-categories';
import PageHeader from '@/components/PageHeader';

export default function MaterialCategoryPage() {
  const [data, setData] = useState<MaterialCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [flatList, setFlatList] = useState<MaterialCategory[]>([]);

  const flatten = (list: MaterialCategory[]): MaterialCategory[] => {
    const result: MaterialCategory[] = [];
    for (const item of list) {
      result.push(item);
      if (item.children?.length) {
        result.push(...flatten(item.children));
      }
    }
    return result;
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMaterialCategories();
      setData(res || []);
      setFlatList(flatten(res || []));
    } catch {
      message.error('加载分类数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const generateCode = useCallback(
    (parentId?: string) => {
      const siblings = flatList.filter((c) =>
        parentId ? c.parentId === parentId : !c.parentId,
      );
      const next = String(siblings.length + 1).padStart(2, '0');
      if (parentId) {
        const parent = flatList.find((c) => c.id === parentId);
        return parent ? `${parent.code}${next}` : next;
      }
      return next;
    },
    [flatList],
  );

  const openCreateModal = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldValue('code', generateCode());
    setModalOpen(true);
  };

  const openEditModal = (record: MaterialCategory) => {
    setEditingId(record.id);
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      parentId: record.parentId,
      sortOrder: record.sortOrder,
    });
    setModalOpen(true);
  };

  const handleSave = async (values: any) => {
    try {
      if (editingId) {
        await updateMaterialCategory(editingId, values);
        message.success('更新成功');
      } else {
        await createMaterialCategory(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || '保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMaterialCategory(id);
      message.success('删除成功');
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const levelColors: Record<number, string> = {
    1: 'blue',
    2: 'green',
    3: 'orange',
  };

  const columns = [
    {
      title: '编码',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '层级',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (v: number) => (
        <Tag color={levelColors[v] || 'default'}>L{v}</Tag>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 80,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: MaterialCategory) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除?"
            description="删除前请确保该分类下没有子分类"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="物料分类" />
      <Space wrap style={{ marginBottom: 16 }} className="page-search-bar">
        <Button
          type="primary"
          onClick={openCreateModal}
          icon={<PlusOutlined />}
        >
          新建分类
        </Button>
      </Space>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={false}
        childrenColumnName="children"
        defaultExpandAllRows
      />
      <Modal
        title={editingId ? '编辑分类' : '新建分类'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            label="分类编码"
            name="code"
            rules={[{ required: true, message: '请输入编码' }]}
          >
            <Input placeholder="如：01、AJ、CH" />
          </Form.Item>
          <Form.Item
            label="分类名称"
            name="name"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="如：移动电源、彩盒" />
          </Form.Item>
          <Form.Item label="父分类" name="parentId">
            <Select
              allowClear
              placeholder="不选则为顶级分类"
              options={flatList.map((c) => ({
                value: c.id,
                label: `${c.code} - ${c.name}`,
              }))}
              onChange={(parentId) => {
                if (!editingId) {
                  form.setFieldValue('code', generateCode(parentId));
                }
              }}
            />
          </Form.Item>
          <Form.Item label="排序" name="sortOrder" initialValue={0}>
            <Input type="number" placeholder="数字越小越靠前" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
