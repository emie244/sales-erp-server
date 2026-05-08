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
  Upload,
} from 'antd';
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  batchCreateCustomers,
  fetchCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
} from '@/api/customers';
import PageHeader from '@/components/PageHeader';
import RegionCascader from '@/components/RegionCascader';
import * as XLSX from 'xlsx';

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

  // 批量导入
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const loadData = async (p = page, ps = pageSize) => {
    setLoading(true);
    try {
      const res = await fetchCustomers({ page: p, pageSize: ps });
      setData(res.data);
      setTotal(res.total ?? 0);
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

  // 批量导入相关
  const handleDownloadTemplate = () => {
    const headers = [
      { 客户名称: '', 联系人: '', 电话: '', 客户等级: 'C', 信用额度: 0, 账期: 0, 地址: '' },
    ];
    const ws = XLSX.utils.json_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '客户导入模板');
    XLSX.writeFile(wb, '客户导入模板.xlsx');
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);

      if (!jsonData || jsonData.length === 0) {
        message.error('文件为空或格式不正确');
        return;
      }

      const mapped = jsonData.map((row: any) => ({
        name: row['客户名称'] || row['name'] || '',
        contactName: row['联系人'] || row['contactName'] || '',
        phone: row['电话'] || row['phone'] || '',
        level: row['客户等级'] || row['level'] || 'C',
        creditLimit: Number(row['信用额度'] || row['creditLimit'] || 0),
        paymentTerms: Number(row['账期'] || row['paymentTerms'] || 0),
        address: row['地址'] || row['address'] || '',
      }));

      const valid = mapped.filter((r: any) => r.name);
      const invalid = mapped.filter((r: any) => !r.name);

      if (invalid.length > 0) {
        message.warning(`${invalid.length} 行缺少客户名称，已自动过滤`);
      }

      setImportData(valid);
    };
    reader.readAsArrayBuffer(file);
    return false; // 阻止 Upload 组件自动上传
  };

  const handleImportSubmit = async () => {
    if (importData.length === 0) {
      message.error('没有可导入的数据');
      return;
    }
    setImportLoading(true);
    try {
      const res = await batchCreateCustomers(importData);
      message.success(`成功导入 ${res.imported} 个客户`);
      setImportModalOpen(false);
      setImportData([]);
      loadData();
    } catch {
      message.error('导入失败');
    } finally {
      setImportLoading(false);
    }
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
    { title: '客户名称', dataIndex: 'name', key: 'name', width: 160, ellipsis: true },
    { title: '联系人', dataIndex: 'contactName', key: 'contactName', width: 100, ellipsis: true },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 120, ellipsis: true },
    { title: '等级', dataIndex: 'level', key: 'level', width: 70 },
    {
      title: '预收款余额',
      dataIndex: 'prepaymentBalance',
      key: 'prepaymentBalance',
      width: 120,
      align: 'right' as const,
      render: (v: number) => `¥${parseFloat(v?.toString() || '0').toFixed(2)}`,
    },
    { title: '地址', dataIndex: 'address', key: 'address', width: 200, ellipsis: true },
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
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" onClick={() => openAddressModal(record)}>
            地址簿
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
      <PageHeader title="客户列表">
        <Button onClick={() => setImportModalOpen(true)}>批量导入</Button>
        <Button type="primary" onClick={handleCreate}>
          + 新建客户
        </Button>
      </PageHeader>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 1070 }}
        style={{ width: '100%' }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
            loadData(p, ps);
          },
        }}
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

      {/* 批量导入弹窗 */}
      <Modal
        title="批量导入客户"
        open={importModalOpen}
        onCancel={() => {
          setImportModalOpen(false);
          setImportData([]);
        }}
        footer={null}
        destroyOnClose
        width={700}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Button onClick={handleDownloadTemplate}>下载导入模板</Button>
            <Upload
              accept=".xlsx,.xls"
              beforeUpload={handleFileUpload}
              showUploadList={false}
            >
              <Button>选择 Excel 文件</Button>
            </Upload>
          </Space>

          {importData.length > 0 && (
            <>
              <div style={{ marginTop: 8 }}>
                共解析到 <strong>{importData.length}</strong> 条有效数据
              </div>
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                <Table
                  size="small"
                  rowKey={(_r, i) => String(i)}
                  columns={[
                    { title: '客户名称', dataIndex: 'name', key: 'name' },
                    { title: '联系人', dataIndex: 'contactName', key: 'contactName' },
                    { title: '电话', dataIndex: 'phone', key: 'phone' },
                    { title: '等级', dataIndex: 'level', key: 'level' },
                    { title: '信用额度', dataIndex: 'creditLimit', key: 'creditLimit' },
                    { title: '账期', dataIndex: 'paymentTerms', key: 'paymentTerms' },
                    { title: '地址', dataIndex: 'address', key: 'address' },
                  ]}
                  dataSource={importData}
                  pagination={false}
                />
              </div>
            </>
          )}

          <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 16 }}>
            <Button
              onClick={() => {
                setImportModalOpen(false);
                setImportData([]);
              }}
            >
              取消
            </Button>
            <Button
              type="primary"
              loading={importLoading}
              disabled={importData.length === 0}
              onClick={handleImportSubmit}
            >
              确认导入
            </Button>
          </Space>
        </Space>
      </Modal>
    </div>
  );
}
