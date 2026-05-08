import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  Select,
  message,
  Tag,
  Checkbox,
  Card,
  Row,
  Col,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { fetchUsers, updateUser, createUser } from '@/api/users';
import { getAllPermissions } from '@/utils/permissions';
import PageHeader from '@/components/PageHeader';

export default function AdminPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const allPermissions = getAllPermissions();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchUsers();
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

  const allPermissionKeys = allPermissions.flatMap((m) =>
    m.permissions.map((p) => p.key),
  );

  const expandWildcard = (perms: string[]) => {
    if (perms.includes('*')) return [...allPermissionKeys];
    return perms;
  };

  const collapseWildcard = (perms: string[]) => {
    if (allPermissionKeys.every((k) => perms.includes(k))) return ['*'];
    return perms;
  };

  const handleEdit = (record: any) => {
    setEditing(record);
    const perms = expandWildcard(record.permissions || []);
    setSelectedPermissions(perms);
    form.setFieldsValue({
      ...record,
      permissions: perms,
    });
    setOpen(true);
  };

  const handleCreate = () => {
    setEditing(null);
    setSelectedPermissions([]);
    form.resetFields();
    setOpen(true);
  };

  const handleDelete = (record: any) => {
    Modal.confirm({
      title: '确认删除用户',
      content: `确定要删除用户「${record.name}」吗？删除后该用户将无法登录。`,
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await updateUser(record.id, { isActive: false });
          message.success('删除成功');
          loadData();
        } catch {
          message.error('操作失败');
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        permissions: collapseWildcard(selectedPermissions),
      };

      if (editing) {
        await updateUser(editing.id, payload);
        message.success('保存成功');
      } else {
        // 新建用户
        if (!values.name || !values.email) {
          message.error('用户名和邮箱必填');
          return;
        }
        await createUser(payload);
        message.success('创建成功');
      }

      setOpen(false);
      form.resetFields();
      setEditing(null);
      setSelectedPermissions([]);
      loadData();
    } catch {
      message.error('保存失败');
    }
  };

  const togglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm],
    );
  };

  const toggleModule = (modulePerms: string[]) => {
    const allSelected = modulePerms.every((p) =>
      selectedPermissions.includes(p),
    );
    if (allSelected) {
      setSelectedPermissions((prev) =>
        prev.filter((p) => !modulePerms.includes(p)),
      );
    } else {
      setSelectedPermissions((prev) => {
        const newPerms = [...prev];
        modulePerms.forEach((p) => {
          if (!newPerms.includes(p)) newPerms.push(p);
        });
        return newPerms;
      });
    }
  };

  const columns = [
    { title: '用户名', dataIndex: 'name', key: 'name', width: 100, ellipsis: true },
    { title: '邮箱', dataIndex: 'email', key: 'email', width: 180, ellipsis: true },
    {
      title: '飞书 User ID',
      dataIndex: 'feishuUserId',
      key: 'feishuUserId',
      width: 160,
      ellipsis: true,
    },
    {
      title: '聚水潭店铺ID',
      dataIndex: 'jushuitanShopId',
      key: 'jushuitanShopId',
      width: 120,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 90,
      render: (v: string) =>
        v === 'admin' ? <Tag color="blue">管理员</Tag> : <Tag>普通用户</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (v: boolean) =>
        v ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      width: 200,
      ellipsis: true,
      render: (v: string[]) => {
        if (!v || v.length === 0) return '-';
        if (v.includes('*')) return <Tag color="blue">全部权限</Tag>;
        return (
          <span style={{ color: '#A0A0A0', fontSize: 12 }}>{v.length} 个权限</span>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          {record.isActive !== false && (
            <Button type="link" size="small" danger onClick={() => handleDelete(record)}>
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="用户管理">
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建用户
        </Button>
      </PageHeader>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 1050 }}
        style={{ width: '100%' }}
      />
      <Modal
        title={editing ? '编辑用户' : '新建用户'}
        open={open}
        onCancel={() => {
          setOpen(false);
          setEditing(null);
          form.resetFields();
          setSelectedPermissions([]);
        }}
        footer={null}
        destroyOnClose
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="用户名"
            name="name"
            rules={[{ required: !editing, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" disabled={!!editing} />
          </Form.Item>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[{ required: !editing, message: '请输入邮箱' }]}
          >
            <Input placeholder="请输入邮箱" disabled={!!editing} />
          </Form.Item>
          <Form.Item label="飞书 Open ID" name="feishuOpenId">
            <Input placeholder="请输入飞书 Open ID" />
          </Form.Item>
          <Form.Item label="飞书 User ID" name="feishuUserId">
            <Input placeholder="请输入飞书 User ID" />
          </Form.Item>
          <Form.Item label="聚水潭店铺ID" name="jushuitanShopId">
            <Input placeholder="请输入聚水潭店铺ID" />
          </Form.Item>
          <Form.Item label="角色" name="role">
            <Select
              options={[
                { label: '管理员', value: 'admin' },
                { label: '普通用户', value: 'user' },
              ]}
            />
          </Form.Item>
          <Form.Item label="状态" name="isActive" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          {/* 权限配置 */}
          <Form.Item label="权限配置">
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              {allPermissions.map((module) => {
                const modulePerms = module.permissions.map((p) => p.key);
                const allSelected = modulePerms.every((p) =>
                  selectedPermissions.includes(p),
                );
                const someSelected = modulePerms.some((p) =>
                  selectedPermissions.includes(p),
                );

                return (
                  <Card
                    key={module.module}
                    size="small"
                    title={
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected && !allSelected}
                        onChange={() => toggleModule(modulePerms)}
                      >
                        <strong>{module.module}</strong>
                      </Checkbox>
                    }
                    style={{ marginBottom: 8 }}
                  >
                    <Row gutter={[16, 8]}>
                      {module.permissions.map((perm) => (
                        <Col span={8} key={perm.key}>
                          <Checkbox
                            checked={selectedPermissions.includes(perm.key)}
                            onChange={() => togglePermission(perm.key)}
                          >
                            {perm.label}
                          </Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </Card>
                );
              })}
            </div>
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
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
