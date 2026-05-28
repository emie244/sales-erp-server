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

  // search/filter/sort state
  const [keyword, setKeyword] = useState('');
  const [levelFilter, setLevelFilter] = useState<number | undefined>(undefined);
  const [sortField, setSortField] = useState<'code' | 'name' | 'sortOrder'>(
    'sortOrder',
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const loadData = useCallback(async () => {
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

    setLoading(true);
    try {
      const res = await fetchMaterialCategories({
        keyword: keyword || undefined,
      });
      let filtered = res || [];
      // Apply level filter client-side since tree structure
      if (levelFilter !== undefined) {
        const filterByLevel = (
          list: MaterialCategory[],
        ): MaterialCategory[] => {
          return list
            .filter((item) => item.level === levelFilter)
            .map((item) => ({
              ...item,
              children: item.children ? filterByLevel(item.children) : [],
            }));
        };
        filtered = filterByLevel(filtered);
      }
      // Apply sort client-side
      const sortFn = (a: MaterialCategory, b: MaterialCategory) => {
        let cmp = 0;
        if (sortField === 'code') {
          cmp = a.code.localeCompare(b.code);
        } else if (sortField === 'name') {
          cmp = a.name.localeCompare(b.name);
        } else {
          cmp = (a.sortOrder || 0) - (b.sortOrder || 0);
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      };
      const sortTree = (list: MaterialCategory[]): MaterialCategory[] => {
        return list.sort(sortFn).map((item) => ({
          ...item,
          children: item.children ? sortTree(item.children) : [],
        }));
      };
      filtered = sortTree(filtered);

      setData(filtered);
      setFlatList(flatten(filtered));
    } catch {
      message.error('加载分类数据失败');
    } finally {
      setLoading(false);
    }
  }, [keyword, levelFilter, sortField, sortOrder]);

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

  const handleSave = async (values: {
    code: string;
    name: string;
    parentId?: string;
    sortOrder?: number;
  }) => {
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败';
      message.error(msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMaterialCategory(id);
      message.success('删除成功');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除失败';
      message.error(msg);
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
      fixed: 'right' as const,
      render: (_: unknown, record: MaterialCategory) => (
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

  const handleSearch = () => {
    loadData();
  };

  const handleReset = () => {
    setKeyword('');
    setLevelFilter(undefined);
    setSortField('sortOrder');
    setSortOrder('asc');
    loadData();
  };

  return (
    <div
      style={{
        height: 'calc(100vh - 104px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <PageHeader title="物料分类" />
      <Space
        wrap
        style={{ marginBottom: 16, flexShrink: 0 }}
        className="page-search-bar"
      >
        <Input.Search
          placeholder="搜索编码 / 名称"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={handleSearch}
          style={{ width: 260 }}
          allowClear
        />
        <Select
          placeholder="层级筛选"
          value={levelFilter}
          onChange={(v) => setLevelFilter(v)}
          style={{ width: 140 }}
          allowClear
          options={[
            { label: 'L1', value: 1 },
            { label: 'L2', value: 2 },
            { label: 'L3', value: 3 },
          ]}
        />
        <Select
          placeholder="排序字段"
          value={sortField}
          onChange={(v) => setSortField(v)}
          style={{ width: 140 }}
          options={[
            { label: '排序号', value: 'sortOrder' },
            { label: '编码', value: 'code' },
            { label: '名称', value: 'name' },
          ]}
        />
        <Select
          placeholder="排序方式"
          value={sortOrder}
          onChange={(v) => setSortOrder(v)}
          style={{ width: 120 }}
          options={[
            { label: '升序', value: 'asc' },
            { label: '降序', value: 'desc' },
          ]}
        />
        <Button onClick={handleSearch}>查询</Button>
        <Button onClick={handleReset}>重置</Button>
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
        sticky
        pagination={false}
        childrenColumnName="children"
        defaultExpandAllRows
        scroll={{ x: 600, y: 'calc(100vh - 360px)' }}
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
