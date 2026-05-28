import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Popconfirm, Tag, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { fetchSuppliers, createSupplier, updateSupplier, deleteSupplier } from '@/api/suppliers';
import type { Supplier } from '@/api/suppliers';
import PageHeader from '@/components/PageHeader';

export default function SupplierPage() {
  const [data, setData] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });

  const loadData = async (page = pagination.current, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const res = await fetchSuppliers({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: status || undefined,
        sortField,
        sortOrder,
      });
      setData(res.data);
      setPagination({
        current: res.page,
        pageSize: res.pageSize,
        total: res.total,
      });
    } catch {
      message.error('加载供应商列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, status, sortField, sortOrder]);

  const openCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: Supplier) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleSave = async (values: any) => {
    try {
      if (editingId) {
        await updateSupplier(editingId, values);
        message.success('更新成功');
      } else {
        await createSupplier(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      loadData();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSupplier(id);
      message.success('删除成功');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleTableChange = (newPagination: any) => {
    loadData(newPagination.current, newPagination.pageSize);
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 160, ellipsis: true },
    { title: '联系人', dataIndex: 'contactName', key: 'contactName', width: 120, render: (v: string) => v || '-' },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 140, render: (v: string) => v || '-' },
    { title: '邮箱', dataIndex: 'email', key: 'email', width: 180, ellipsis: true, render: (v: string) => v || '-' },
    { title: '地址', dataIndex: 'address', key: 'address', width: 200, ellipsis: true, render: (v: string) => v || '-' },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'status',
      width: 80,
      render: (v: boolean) => v ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right' as const,
      render: (_: any, record: Supplier) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="供应商管理">
        <Space>
          <Input.Search
            placeholder="搜索名称/联系人/电话"
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={() => loadData(1)}
            style={{ width: 220 }}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            value={status || undefined}
            onChange={(v) => { setStatus(v || ''); }}
            style={{ width: 120 }}
            options={[
              { label: '全部', value: '' },
              { label: '启用', value: 'active' },
              { label: '停用', value: 'inactive' },
            ]}
          />
          <Select
            value={`${sortField}-${sortOrder}`}
            onChange={(v) => {
              const [field, order] = v.split('-');
              setSortField(field);
              setSortOrder(order as 'ASC' | 'DESC');
            }}
            style={{ width: 140 }}
            options={[
              { label: '创建时间 ↓', value: 'createdAt-DESC' },
              { label: '创建时间 ↑', value: 'createdAt-ASC' },
              { label: '名称 ↓', value: 'name-DESC' },
              { label: '名称 ↑', value: 'name-ASC' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建供应商</Button>
        </Space>
      </PageHeader>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        sticky
        scroll={{ x: 1020, y: 'calc(100vh - 360px)' }}
        style={{ width: '100%' }}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
        }}
        onChange={handleTableChange}
      />
      <Modal
        title={editingId ? '编辑供应商' : '新建供应商'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="供应商名称" />
          </Form.Item>
          <Form.Item name="contactName" label="联系人">
            <Input placeholder="联系人姓名" />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input placeholder="联系电话" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="邮箱地址" />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input placeholder="地址" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
