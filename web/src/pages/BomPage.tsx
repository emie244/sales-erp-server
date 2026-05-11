import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, Select,
  InputNumber, message, Popconfirm, Tag, Typography, Divider,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CalculatorOutlined } from '@ant-design/icons';
import { fetchBoms, createBom, updateBom, deleteBom, calculateRequirements } from '@/api/boms';
import { fetchProducts } from '@/api/products';
import type { BomHeader } from '@/api/boms';
import type { ProductSku, Product } from '@/types';
import PageHeader from '@/components/PageHeader';

const { Text } = Typography;
const { Option } = Select;

interface SkuOption {
  id: string;
  productId: string;
  skuCode: string;
  skuName?: string;
  productName?: string;
}

export default function BomPage() {
  const [data, setData] = useState<BomHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [skuOptions, setSkuOptions] = useState<SkuOption[]>([]);
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [calcResult, setCalcResult] = useState<any[]>([]);
  const [calcForm] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchBoms({ page, pageSize, keyword: keyword || undefined });
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch {
      message.error('加载 BOM 数据失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword]);

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetchProducts();
      const skus: SkuOption[] = [];
      (res.data || []).forEach((p: Product) => {
        p.skus?.forEach((s: ProductSku) => {
          skus.push({
            id: s.id,
            productId: s.productId,
            skuCode: s.skuCode,
            skuName: s.skuName,
            productName: p.name,
          });
        });
      });
      setSkuOptions(skus);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadData();
    loadProducts();
  }, [loadData, loadProducts]);

  const handleSearch = () => {
    setPage(1);
    loadData();
  };

  const openCreateModal = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ items: [], version: 'v1' });
    setModalOpen(true);
  };

  const openEditModal = (record: BomHeader) => {
    setEditingId(record.id);
    form.setFieldsValue({
      skuId: record.skuId,
      version: record.version,
      remark: record.remark,
      items: record.items?.map(i => ({
        materialSkuId: i.materialSkuId,
        qty: i.qty,
        lossRate: i.lossRate,
        remark: i.remark,
      })) || [],
    });
    setModalOpen(true);
  };

  const handleSave = async (values: any) => {
    const selectedSku = skuOptions.find(s => s.id === values.skuId);
    if (!selectedSku) {
      message.error('请选择 SKU');
      return;
    }

    const payload = {
      productId: selectedSku.productId,
      skuId: values.skuId,
      version: values.version || 'v1',
      remark: values.remark,
      items: values.items || [],
    };

    try {
      if (editingId) {
        await updateBom(editingId, payload);
        message.success('BOM 更新成功');
      } else {
        await createBom(payload);
        message.success('BOM 创建成功');
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || '保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBom(id);
      message.success('删除成功');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleCalculate = async (values: any) => {
    const items = values.items?.filter((i: any) => i.skuId && i.qty > 0) || [];
    if (!items.length) {
      message.error('请至少输入一项');
      return;
    }
    try {
      const res = await calculateRequirements(items);
      setCalcResult(res || []);
    } catch {
      message.error('计算失败');
    }
  };

  const columns = [
    {
      title: '产品/SKU',
      key: 'sku',
      width: 200,
      ellipsis: true,
      render: (_: any, record: BomHeader) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.skuId}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.remark || '-'}</Text>
        </div>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'status',
      width: 80,
      render: (v: boolean) => v ? <Tag color="success">生效中</Tag> : <Tag>已停用</Tag>,
    },
    {
      title: '子物料数',
      key: 'itemCount',
      width: 100,
      render: (_: any, record: BomHeader) => record.items?.length || 0,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: BomHeader) => (
        <Space>
          <Button type="link" size="small" onClick={() => openEditModal(record)}>
            <EditOutlined /> 编辑
          </Button>
          <Popconfirm
            title="确认删除?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" size="small" danger>
              <DeleteOutlined /> 删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="BOM 管理" />
      <Space wrap style={{ marginBottom: 16 }} className="page-search-bar">
        <Input
          placeholder="搜索 SKU/产品名"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
          style={{ width: 260 }}
        />
        <Button type="primary" onClick={handleSearch}>查询</Button>
        <Button type="primary" onClick={openCreateModal} icon={<PlusOutlined />}>
          新建 BOM
        </Button>
        <Button onClick={() => { setCalcModalOpen(true); setCalcResult([]); calcForm.resetFields(); }} icon={<CalculatorOutlined />}>
          物料需求计算
        </Button>
      </Space>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: false,
          onChange: (p) => { setPage(p); },
        }}
        scroll={{ x: 780 }}
        style={{ width: '100%' }}
          expandable={{
            expandedRowRender: (record: BomHeader) => (
              <Table
                dataSource={record.items || []}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: '子物料 SKU', dataIndex: 'materialSkuId', key: 'materialSkuId' },
                  { title: '用量', dataIndex: 'qty', key: 'qty', render: (v: number) => Number(v).toFixed(2) },
                  { title: '损耗率(%)', dataIndex: 'lossRate', key: 'lossRate', render: (v: number) => Number(v || 0).toFixed(2) },
                  { title: '备注', dataIndex: 'remark', key: 'remark', render: (v: string) => v || '-' },
                ]}
              />
            ),
          }}
        />

      {/* BOM 编辑/创建弹窗 */}
      <Modal
        title={editingId ? '编辑 BOM' : '新建 BOM'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        width={720}
        destroyOnClose
      >
        <Form form={form} onFinish={handleSave} layout="vertical">
          <Form.Item
            name="skuId"
            label="产品 SKU"
            rules={[{ required: true, message: '请选择 SKU' }]}
          >
            <Select
              placeholder="选择产品 SKU"
              showSearch
              optionFilterProp="children"
              disabled={!!editingId}
            >
              {skuOptions.map(s => (
                <Option key={s.id} value={s.id}>
                  {s.skuCode} {s.skuName ? `(${s.skuName})` : ''} - {s.productName}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="version"
            label="版本号"
            rules={[{ required: true }]}
          >
            <Input placeholder="如 v1" />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Divider>子物料清单</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <div>
                {fields.map((field) => (
                  <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...field}
                      name={[field.name, 'materialSkuId']}
                      rules={[{ required: true, message: '请选择物料' }]}
                      style={{ width: 240 }}
                    >
                      <Select placeholder="选择子物料" showSearch optionFilterProp="children">
                        {skuOptions.map(s => (
                          <Option key={s.id} value={s.id}>
                            {s.skuCode} {s.skuName ? `(${s.skuName})` : ''}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'qty']}
                      rules={[{ required: true, message: '请输入用量' }]}
                      style={{ width: 120 }}
                    >
                      <InputNumber placeholder="用量" min={0.01} step={0.01} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'lossRate']}
                      style={{ width: 100 }}
                    >
                      <InputNumber placeholder="损耗%" min={0} max={100} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'remark']}
                      style={{ width: 160 }}
                    >
                      <Input placeholder="备注" />
                    </Form.Item>
                    <Button type="link" danger onClick={() => remove(field.name)}>
                      删除
                    </Button>
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ qty: 1, lossRate: 0 })} block icon={<PlusOutlined />}>
                  添加子物料
                </Button>
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* 物料需求计算弹窗 */}
      <Modal
        title="物料需求计算"
        open={calcModalOpen}
        onCancel={() => setCalcModalOpen(false)}
        width={700}
        footer={null}
      >
        <Form form={calcForm} onFinish={handleCalculate}>
          <Form.List name="items" initialValue={[{}]}>
            {(fields, { add, remove }) => (
              <div>
                {fields.map((field) => (
                  <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...field}
                      name={[field.name, 'skuId']}
                      rules={[{ required: true }]}
                      style={{ width: 240 }}
                    >
                      <Select placeholder="选择产品 SKU" showSearch>
                        {skuOptions.map(s => (
                          <Option key={s.id} value={s.id}>
                            {s.skuCode}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'qty']}
                      rules={[{ required: true }]}
                      style={{ width: 120 }}
                    >
                      <InputNumber placeholder="数量" min={1} style={{ width: '100%' }} />
                    </Form.Item>
                    <Button type="link" danger onClick={() => remove(field.name)}>删除</Button>
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  添加产品
                </Button>
              </div>
            )}
          </Form.List>
          <Button type="primary" htmlType="submit" style={{ marginTop: 16 }}>
            <CalculatorOutlined /> 计算需求
          </Button>
        </Form>

        {calcResult.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <Divider>计算结果</Divider>
            <Table
              dataSource={calcResult}
              rowKey="materialSkuId"
              size="small"
              pagination={false}
              columns={[
                { title: '物料 SKU', dataIndex: 'materialSkuId', key: 'sku' },
                { title: '总需求量', dataIndex: 'totalQty', key: 'qty', render: (v: number) => v.toFixed(2) },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
