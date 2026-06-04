import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Popconfirm,
  Tag,
  Typography,
  Divider,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CalculatorOutlined,
  CloudUploadOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import {
  fetchBoms,
  createBom,
  updateBom,
  deleteBom,
  cloneBom,
  toggleBomActive,
  calculateRequirements,
} from '@/api/boms';
import { fetchProducts } from '@/api/products';
import axios from '@/api/axios';
import { fetchMaterialCategories } from '@/api/material-categories';
import type { BomHeader } from '@/api/boms';
import type { MaterialCategory } from '@/api/material-categories';
import type { ProductSku, Product } from '@/types';

const { Text } = Typography;
const { Option } = Select;

interface SkuOption {
  id: string;
  productId: string;
  skuCode: string;
  skuName?: string;
  productName?: string;
}

export default function BomManagement() {
  const [data, setData] = useState<BomHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [skuOptions, setSkuOptions] = useState<SkuOption[]>([]);
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [calcResult, setCalcResult] = useState<any[]>([]);
  const [calcForm] = Form.useForm();
  const [categoryOptions, setCategoryOptions] = useState<MaterialCategory[]>(
    [],
  );
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<BomHeader | null>(null);
  const [cloneLoading, setCloneLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchBoms({
        page,
        pageSize,
        keyword: keyword || undefined,
        productId: productFilter || undefined,
        skuId: skuFilter || undefined,
        sortBy: sortBy || undefined,
      });
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch {
      message.error('加载 BOM 数据失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, productFilter, skuFilter, sortBy]);

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

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetchMaterialCategories();
      setCategoryOptions(res || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [loadProducts, loadCategories]);

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
      items:
        record.items?.map((i) => ({
          materialSkuId: i.materialSkuId,
          qty: i.qty,
          lossRate: i.lossRate,
          materialCategoryId: i.materialCategoryId,
          remark: i.remark,
        })) || [],
    });
    setModalOpen(true);
  };

  const handleSave = async (values: any) => {
    const selectedSku = skuOptions.find((s) => s.id === values.skuId);
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

  const handleSyncBom = async (id: string) => {
    try {
      await axios.post(`/boms/${id}/push-jushuitan`);
      message.success('BOM 推送任务已启动');
    } catch (err: any) {
      message.error(err.response?.data?.message || '推送失败');
    }
  };

  const openCloneModal = (record: BomHeader) => {
    setCloneTarget(record);
    setCloneModalOpen(true);
  };

  const handleClone = async (values: { version?: string }) => {
    if (!cloneTarget) return;
    setCloneLoading(true);
    try {
      await cloneBom(cloneTarget.id, values.version);
      message.success('BOM 复制成功');
      setCloneModalOpen(false);
      setCloneTarget(null);
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || '复制失败');
    } finally {
      setCloneLoading(false);
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
      width: 260,
      ellipsis: true,
      render: (_: any, record: BomHeader) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {record.productName
              ? `${record.productName} / ${record.skuName || record.skuCode || record.skuId}`
              : record.skuName || record.skuCode || record.skuId}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.skuId}
            {record.remark ? ` · ${record.remark}` : ''}
          </Text>
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
      width: 100,
      render: (v: boolean, record: BomHeader) => (
        <Switch
          checked={v}
          checkedChildren="生效"
          unCheckedChildren="停用"
          onChange={async (checked) => {
            try {
              await toggleBomActive(record.id);
              message.success(checked ? 'BOM 已启用' : 'BOM 已停用');
              loadData();
            } catch {
              message.error('状态切换失败');
            }
          }}
        />
      ),
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
      render: (v: string) => (v ? new Date(v).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_: any, record: BomHeader) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => openEditModal(record)}
          >
            <EditOutlined /> 编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => openCloneModal(record)}
          >
            复制
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CloudUploadOutlined />}
            onClick={() => handleSyncBom(record.id)}
          >
            同步
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
      <Space wrap style={{ marginBottom: 16 }} className="page-search-bar">
        <Input
          placeholder="搜索 SKU/产品名"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
          style={{ width: 260 }}
        />
        <Select
          placeholder="按产品筛选"
          value={productFilter || undefined}
          onChange={(v) => { setProductFilter(v); setSkuFilter(''); setPage(1); }}
          style={{ width: 200 }}
          allowClear
          showSearch
          optionFilterProp="children"
        >
          {skuOptions.map((s) => (
            <Option key={s.productId} value={s.productId}>
              {s.productName}
            </Option>
          ))}
        </Select>
        <Select
          placeholder="按 SKU 筛选"
          value={skuFilter || undefined}
          onChange={(v) => { setSkuFilter(v); setPage(1); }}
          style={{ width: 200 }}
          allowClear
          showSearch
          optionFilterProp="children"
        >
          {(productFilter
            ? skuOptions.filter((s) => s.productId === productFilter)
            : skuOptions
          ).map((s) => (
            <Option key={s.id} value={s.skuCode}>
              {s.skuCode} {s.skuName ? `(${s.skuName})` : ''}
            </Option>
          ))}
        </Select>
        <Select
          placeholder="排序"
          value={sortBy || undefined}
          onChange={(v) => setSortBy(v)}
          style={{ width: 160 }}
          allowClear
        >
          <Option value="createdAt:desc">创建时间 ↓</Option>
          <Option value="createdAt:asc">创建时间 ↑</Option>
          <Option value="version:desc">版本 ↓</Option>
          <Option value="version:asc">版本 ↑</Option>
        </Select>
        <Button type="primary" onClick={handleSearch}>
          查询
        </Button>
        <Button
          onClick={() => {
            setKeyword('');
            setProductFilter('');
            setSkuFilter('');
            setSortBy('');
            setPage(1);
            loadData();
          }}
        >
          重置
        </Button>
        <Button
          type="primary"
          onClick={openCreateModal}
          icon={<PlusOutlined />}
        >
          新建 BOM
        </Button>
        <Button
          onClick={() => {
            setCalcModalOpen(true);
            setCalcResult([]);
            calcForm.resetFields();
          }}
          icon={<CalculatorOutlined />}
        >
          物料需求计算
        </Button>
      </Space>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        sticky
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: false,
          onChange: (p) => {
            setPage(p);
          },
        }}
        scroll={{ x: 780, y: 'calc(100vh - 360px)' }}
        style={{ width: '100%' }}
        expandable={{
          expandedRowRender: (record: BomHeader) => (
            <Table
              dataSource={record.items || []}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                {
                  title: '子物料 SKU',
                  dataIndex: 'materialSkuId',
                  key: 'materialSkuId',
                },
                {
                  title: '用量',
                  dataIndex: 'qty',
                  key: 'qty',
                  render: (v: number) => Number(v).toFixed(2),
                },
                {
                  title: '损耗率(%)',
                  dataIndex: 'lossRate',
                  key: 'lossRate',
                  render: (v: number) => Number(v || 0).toFixed(2),
                },
                {
                  title: '分类',
                  dataIndex: 'materialCategoryName',
                  key: 'category',
                  render: (v: string) => v || '-',
                },
                {
                  title: '备注',
                  dataIndex: 'remark',
                  key: 'remark',
                  render: (v: string) => v || '-',
                },
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
              {skuOptions.map((s) => (
                <Option key={s.id} value={s.id}>
                  {s.skuCode} {s.skuName ? `(${s.skuName})` : ''} -{' '}
                  {s.productName}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="version" label="版本号" rules={[{ required: true }]}>
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
                  <Space
                    key={field.key}
                    style={{ display: 'flex', marginBottom: 8 }}
                    align="baseline"
                  >
                    <Form.Item
                      {...field}
                      name={[field.name, 'materialSkuId']}
                      rules={[{ required: true, message: '请选择物料' }]}
                      style={{ width: 240 }}
                    >
                      <Select
                        placeholder="选择子物料"
                        showSearch
                        optionFilterProp="children"
                      >
                        {skuOptions.map((s) => (
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
                      <InputNumber
                        placeholder="用量"
                        min={0.01}
                        step={0.01}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'lossRate']}
                      style={{ width: 80 }}
                    >
                      <InputNumber
                        placeholder="损耗%"
                        min={0}
                        max={100}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'materialCategoryId']}
                      style={{ width: 120 }}
                    >
                      <Select placeholder="分类" allowClear>
                        {categoryOptions.map((c) => (
                          <Option key={c.id} value={c.id}>
                            {c.name}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'remark']}
                      style={{ width: 140 }}
                    >
                      <Input placeholder="备注" />
                    </Form.Item>
                    <Button
                      type="link"
                      danger
                      onClick={() => remove(field.name)}
                    >
                      删除
                    </Button>
                  </Space>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ qty: 1, lossRate: 0 })}
                  block
                  icon={<PlusOutlined />}
                >
                  添加子物料
                </Button>
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* BOM 复制弹窗 */}
      <Modal
        title="复制 BOM"
        open={cloneModalOpen}
        onCancel={() => {
          setCloneModalOpen(false);
          setCloneTarget(null);
        }}
        onOk={() => {
          const values = { version: (document.querySelector('#clone-version-input') as HTMLInputElement)?.value };
          handleClone(values);
        }}
        confirmLoading={cloneLoading}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>源 BOM：</strong>
            <Tag>
              {cloneTarget?.productName
                ? `${cloneTarget.productName} / ${cloneTarget.skuName || cloneTarget.skuCode || cloneTarget.skuId}`
                : cloneTarget?.skuName || cloneTarget?.skuCode || cloneTarget?.skuId}
            </Tag>
            <Tag color="blue">{cloneTarget?.version}</Tag>
          </div>
          <div style={{ color: '#666', fontSize: 13 }}>
            将复制该 BOM 的所有子物料到新版本中，新 BOM 默认为停用状态。
          </div>
        </div>
        <Form layout="vertical">
          <Form.Item label="新版本号">
            <Input
              id="clone-version-input"
              placeholder="如 v2，留空则自动递增"
            />
          </Form.Item>
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
                  <Space
                    key={field.key}
                    style={{ display: 'flex', marginBottom: 8 }}
                    align="baseline"
                  >
                    <Form.Item
                      {...field}
                      name={[field.name, 'skuId']}
                      rules={[{ required: true }]}
                      style={{ width: 240 }}
                    >
                      <Select placeholder="选择产品 SKU" showSearch>
                        {skuOptions.map((s) => (
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
                      <InputNumber
                        placeholder="数量"
                        min={1}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                    <Button
                      type="link"
                      danger
                      onClick={() => remove(field.name)}
                    >
                      删除
                    </Button>
                  </Space>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add()}
                  block
                  icon={<PlusOutlined />}
                >
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
                {
                  title: '总需求量',
                  dataIndex: 'totalQty',
                  key: 'qty',
                  render: (v: number) => v.toFixed(2),
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
