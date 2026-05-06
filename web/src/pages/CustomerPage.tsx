import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  message,
  Tag,
  Card,
  List,
  Divider,
  Radio,
} from 'antd';
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
} from '@/api/customers';
import RegionCascader from '@/components/RegionCascader';

export default function CustomerPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  // 地址簿弹窗
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressCustomerId, setAddressCustomerId] = useState<string | null>(null);
  const [addressCustomerName, setAddressCustomerName] = useState('');
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressForm] = Form.useForm();
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);

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

  // 地址簿相关
  const openAddressModal = async (record: any) => {
    setAddressCustomerId(record.id);
    setAddressCustomerName(record.name);
    setAddressModalOpen(true);
    setEditingAddressId(null);
    addressForm.resetFields();
    await loadAddresses(record.id);
  };

  const loadAddresses = async (customerId: string) => {
    setAddressLoading(true);
    try {
      const list = await fetchCustomerAddresses(customerId);
      setAddresses(list);
    } catch {
      message.error('加载地址失败');
    } finally {
      setAddressLoading(false);
    }
  };

  const handleSaveAddress = async (values: any) => {
    if (!addressCustomerId) return;
    try {
      const payload = {
        customerId: addressCustomerId,
        consignee: values.consignee,
        phone: values.phone,
        province: values.region?.[0] || '',
        city: values.region?.[1] || '',
        district: values.region?.[2] || '',
        detailAddress: values.detailAddress,
        isDefault: values.isDefault || false,
      };
      if (editingAddressId) {
        await updateCustomerAddress(editingAddressId, payload);
        message.success('地址更新成功');
      } else {
        await createCustomerAddress(payload);
        message.success('地址添加成功');
      }
      setEditingAddressId(null);
      addressForm.resetFields();
      await loadAddresses(addressCustomerId);
    } catch {
      message.error('保存地址失败');
    }
  };

  const handleEditAddress = (addr: any) => {
    setEditingAddressId(addr.id);
    addressForm.setFieldsValue({
      consignee: addr.consignee,
      phone: addr.phone,
      region: [addr.province, addr.city, addr.district].filter(Boolean),
      detailAddress: addr.detailAddress,
      isDefault: addr.isDefault,
    });
  };

  const handleDeleteAddress = (addr: any) => {
    Modal.confirm({
      title: '确认删除地址',
      content: `确定要删除「${addr.consignee}」的地址吗？`,
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteCustomerAddress(addr.id);
          message.success('删除成功');
          if (addressCustomerId) await loadAddresses(addressCustomerId);
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleSetDefaultAddress = async (addr: any) => {
    try {
      await setDefaultCustomerAddress(addr.id);
      message.success('已设为默认地址');
      if (addressCustomerId) await loadAddresses(addressCustomerId);
    } catch {
      message.error('设置失败');
    }
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
      width: 220,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" onClick={() => openAddressModal(record)}>
            地址簿
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
    <div style={{ width: '100%' }}>
      <Space
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          width: '100%',
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

      {/* 客户编辑弹窗 */}
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

      {/* 地址簿弹窗 */}
      <Modal
        title={`「${addressCustomerName}」地址簿`}
        open={addressModalOpen}
        onCancel={() => {
          setAddressModalOpen(false);
          setAddressCustomerId(null);
          setEditingAddressId(null);
          addressForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={700}
      >
        <Card
          size="small"
          title={editingAddressId ? '编辑地址' : '添加地址'}
          style={{ marginBottom: 16 }}
        >
          <Form form={addressForm} layout="vertical" onFinish={handleSaveAddress}>
            <Form.Item
              label="收货人"
              name="consignee"
              rules={[{ required: true, message: '请输入收货人' }]}
            >
              <Input placeholder="请输入收货人" />
            </Form.Item>
            <Form.Item label="电话" name="phone">
              <Input placeholder="请输入电话" />
            </Form.Item>
            <Form.Item label="省/市/区" name="region">
              <RegionCascader placeholder="请选择省/市/区" />
            </Form.Item>
            <Form.Item label="详细地址" name="detailAddress">
              <Input.TextArea rows={2} placeholder="请输入详细地址" />
            </Form.Item>
            <Form.Item name="isDefault" valuePropName="checked">
              <Radio checked={addressForm.getFieldValue('isDefault')}>
                设为默认地址
              </Radio>
            </Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              {editingAddressId && (
                <Button
                  onClick={() => {
                    setEditingAddressId(null);
                    addressForm.resetFields();
                  }}
                >
                  取消编辑
                </Button>
              )}
              <Button type="primary" htmlType="submit">
                {editingAddressId ? '更新地址' : '添加地址'}
              </Button>
            </Space>
          </Form>
        </Card>

        <Divider style={{ margin: '12px 0' }} />

        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          <List
            loading={addressLoading}
            dataSource={addresses}
            locale={{ emptyText: '暂无地址' }}
            renderItem={(addr) => (
              <List.Item
                actions={[
                  <Button type="link" onClick={() => handleEditAddress(addr)}>
                    编辑
                  </Button>,
                  !addr.isDefault && (
                    <Button type="link" onClick={() => handleSetDefaultAddress(addr)}>
                      设为默认
                    </Button>
                  ),
                  <Button type="link" danger onClick={() => handleDeleteAddress(addr)}>
                    删除
                  </Button>,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{addr.consignee}</span>
                      <span style={{ color: '#A0A0A0' }}>{addr.phone}</span>
                      {addr.isDefault && <Tag color="blue">默认</Tag>}
                    </Space>
                  }
                  description={
                    <span style={{ color: '#A0A0A0' }}>
                      {[addr.province, addr.city, addr.district, addr.detailAddress]
                        .filter(Boolean)
                        .join(' ')}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </Modal>
    </div>
  );
}
