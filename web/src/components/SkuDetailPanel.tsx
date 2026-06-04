import { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Card,
  Tag,
  Button,
  Space,
  Divider,
  Form,
  Select,
  InputNumber,
  Input,
  Table,
  Empty,
  message,
  Image,
  Descriptions,
  Switch,
  Popconfirm,
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  CloseOutlined,
  BuildOutlined,
  InboxOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import axios from '@/api/axios';
import { fetchBomsBySku, createBom, updateBom, type BomHeader } from '@/api/boms';
import { addSkuToProduct } from '@/api/products';
import { fetchMaterialCategories } from '@/api/material-categories';
import QuickCreateMaterialModal from './QuickCreateMaterialModal';
import MultiImageUpload from './MultiImageUpload';
import type { ProductSku } from '@/types';
import type { MaterialCategory } from '@/api/material-categories';

interface Props {
  sku: ProductSku | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  allMaterialSkus: { id: string; skuName?: string; skuCode?: string; itemType?: string }[];
}

interface StockDetail {
  skuId: string;
  warehouseId: string;
  availableQty: number;
  safetyStock: number;
}

export default function SkuDetailPanel({
  sku,
  open,
  onClose,
  onRefresh,
  allMaterialSkus,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [stocks, setStocks] = useState<StockDetail[]>([]);
  const [boms, setBoms] = useState<BomHeader[]>([]);
  const [bomForm] = Form.useForm();
  const [editingBom, setEditingBom] = useState(false);
  const [savingBom, setSavingBom] = useState(false);
  const [materialCategories, setMaterialCategories] = useState<MaterialCategory[]>([]);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [pendingSelectIndex, setPendingSelectIndex] = useState<number | null>(null);

  // 独立操作状态
  const [addingSku, setAddingSku] = useState(false);
  const [addingSkuLoading, setAddingSkuLoading] = useState(false);
  const [skuForm] = Form.useForm();
  const [editingSkuInfo, setEditingSkuInfo] = useState(false);
  const [savingSkuInfo, setSavingSkuInfo] = useState(false);
  const [infoForm] = Form.useForm();
  const [bomVersionMode, setBomVersionMode] = useState<'update' | 'new'>('update');

  const skuKey = sku?.skuCode || sku?.jstSkuId || sku?.id || '';
  const isFinished = sku?.itemType === 'finished_good';

  const loadData = useCallback(async () => {
    if (!skuKey) return;
    setLoading(true);
    try {
      const [stockRes, bomRes] = await Promise.allSettled([
        axios.get(`/stocks/${encodeURIComponent(skuKey)}`),
        fetchBomsBySku(skuKey),
      ]);
      if (stockRes.status === 'fulfilled') {
        const arr = Array.isArray(stockRes.value) ? stockRes.value : [];
        setStocks(arr.map((s: any) => ({
          skuId: s.skuId,
          warehouseId: s.warehouseId,
          availableQty: Number(s.availableQty || 0),
          safetyStock: Number(s.safetyStock || 0),
        })));
      }
      if (bomRes.status === 'fulfilled') {
        setBoms(bomRes.value || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [skuKey]);

  useEffect(() => {
    if (open && sku) {
      loadData();
      fetchMaterialCategories().then(setMaterialCategories).catch(() => {});
    }
  }, [open, sku, loadData]);

  useEffect(() => {
    if (!open) {
      setEditingBom(false);
      setAddingSku(false);
      setEditingSkuInfo(false);
      setBomVersionMode('update');
      bomForm.resetFields();
      skuForm.resetFields();
      infoForm.resetFields();
    }
  }, [open, bomForm, skuForm, infoForm]);

  const handleSaveBom = async (values: any) => {
    if (!sku) return;
    setSavingBom(true);
    try {
      const payload = {
        productId: sku.productId,
        skuId: sku.id,
        version: values.version || 'v1',
        remark: values.remark,
        items: values.items?.map((i: any) => ({
          materialSkuId: i.materialSkuId,
          qty: i.qty,
          lossRate: i.lossRate || 0,
          materialCategoryId: i.materialCategoryId,
          remark: i.remark,
        })) || [],
      };

      const activeBom = boms.find((b) => b.isActive);
      if (activeBom) {
        await updateBom(activeBom.id, { version: payload.version, remark: payload.remark, items: payload.items });
        message.success('BOM 更新成功');
      } else {
        await createBom(payload);
        message.success('BOM 创建成功');
      }
      setEditingBom(false);
      loadData();
      onRefresh();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '保存失败');
    } finally {
      setSavingBom(false);
    }
  };

  const handleToggleActive = async () => {
    if (!sku) return;
    try {
      await axios.patch(`/products/skus/${sku.id}`, { isActive: !sku.isActive });
      message.success(sku.isActive ? 'SKU 已停用' : 'SKU 已启用');
      onRefresh();
    } catch {
      message.error('状态切换失败');
    }
  };

  const handleDelete = async () => {
    if (!sku) return;
    try {
      await axios.delete(`/products/skus/${sku.id}`);
      message.success('删除成功');
      onClose();
      onRefresh();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '删除失败');
    }
  };

  const handleMaterialCreated = (newMaterial: { id: string; skuName: string; skuCode: string }) => {
    if (pendingSelectIndex !== null) {
      const items = bomForm.getFieldValue('items') || [];
      items[pendingSelectIndex] = { ...items[pendingSelectIndex], materialSkuId: newMaterial.id };
      bomForm.setFieldsValue({ items });
      setPendingSelectIndex(null);
    }
  };

  // 为此产品添加新 SKU
  const handleAddSku = async (values: any) => {
    if (!sku?.productId) return;
    setAddingSkuLoading(true);
    try {
      await addSkuToProduct(sku.productId, {
        skuName: values.skuName,
        spec: values.spec,
        salePrice: values.salePrice,
        costPrice: values.costPrice,
        weight: values.weight,
        brand: values.brand,
        pics: values.pics || [],
        pic: values.pics?.[0],
        itemType: sku.itemType,
      });
      message.success('SKU 添加成功');
      setAddingSku(false);
      skuForm.resetFields();
      onRefresh();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '添加失败');
    } finally {
      setAddingSkuLoading(false);
    }
  };

  // 编辑 SKU 基本信息
  const handleSaveSkuInfo = async (values: any) => {
    if (!sku) return;
    setSavingSkuInfo(true);
    try {
      await axios.patch(`/products/skus/${sku.id}`, {
        skuName: values.skuName,
        spec: values.spec,
        salePrice: values.salePrice,
        costPrice: values.costPrice,
        weight: values.weight,
        brand: values.brand,
      });
      message.success('SKU 信息更新成功');
      setEditingSkuInfo(false);
      onRefresh();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '保存失败');
    } finally {
      setSavingSkuInfo(false);
    }
  };

  // 创建新 BOM 版本
  const handleCreateBomVersion = async (values: any) => {
    if (!sku) return;
    setSavingBom(true);
    try {
      const payload = {
        productId: sku.productId,
        skuId: sku.id,
        version: values.version,
        remark: values.remark,
        items: values.items?.map((i: any) => ({
          materialSkuId: i.materialSkuId,
          qty: i.qty,
          lossRate: i.lossRate || 0,
          materialCategoryId: i.materialCategoryId,
          remark: i.remark,
        })) || [],
      };
      await createBom(payload);
      message.success('BOM 新版本创建成功');
      setEditingBom(false);
      setBomVersionMode('update');
      loadData();
      onRefresh();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '创建失败');
    } finally {
      setSavingBom(false);
    }
  };

  const stockColumns = [
    { title: '仓库', dataIndex: 'warehouseId', key: 'warehouseId' },
    {
      title: '可用库存',
      dataIndex: 'availableQty',
      render: (v: number) => (
        <span style={{ color: v > 0 ? '#52c41a' : '#999' }}>{v}</span>
      ),
    },
    { title: '安全库存', dataIndex: 'safetyStock', render: (v: number) => (v > 0 ? v : '--') },
  ];

  const pics = sku?.pic ? [sku.pic] : [];

  return (
    <>
      <Drawer
        title={
          <Space>
            <BuildOutlined />
            <span>SKU 详情</span>
            {sku?.isActive ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>}
          </Space>
        }
        width={560}
        open={open}
        onClose={onClose}
        extra={
          <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
        }
      >
        {sku && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 基本信息 */}
            <Card size="small" loading={loading}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div style={{ width: 80, height: 80, flexShrink: 0, background: '#fafafa', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {pics.length > 0 ? (
                    <Image src={pics[0]} style={{ width: 80, height: 80, objectFit: 'cover' }} preview={{ src: pics[0] }} />
                  ) : (
                    <PictureOutlined style={{ fontSize: 24, color: '#d9d9d9' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                    {sku.skuName || '--'}
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                    {sku.skuCode || sku.jstSkuId || '--'}
                  </div>
                  <Space size={4} wrap>
                    {sku.category && <Tag>{sku.category}</Tag>}
                    {sku.brand && <Tag color="blue">{sku.brand}</Tag>}
                    {sku.itemType && (
                      <Tag color={sku.itemType === 'finished_good' ? 'success' : 'default'}>
                        {sku.itemType === 'finished_good' ? '成品' : sku.itemType === 'semi_finished' ? '半成品' : sku.itemType === 'raw_material' ? '原材料' : '包材'}
                      </Tag>
                    )}
                  </Space>
                </div>
              </div>

              <Descriptions size="small" column={2}>
                <Descriptions.Item label="销售价">{sku.salePrice != null ? `¥${sku.salePrice}` : '--'}</Descriptions.Item>
                <Descriptions.Item label="成本价">{sku.costPrice != null ? `¥${sku.costPrice}` : '--'}</Descriptions.Item>
                <Descriptions.Item label="底价">{sku.floorPrice != null ? `¥${sku.floorPrice}` : '--'}</Descriptions.Item>
                <Descriptions.Item label="重量">{sku.weight != null ? `${sku.weight}kg` : '--'}</Descriptions.Item>
                <Descriptions.Item label="产品">{sku.product?.name || '--'}</Descriptions.Item>
                <Descriptions.Item label="生命周期">{sku.product?.lifecycleStage || '--'}</Descriptions.Item>
              </Descriptions>

              <Divider style={{ margin: '12px 0' }} />

              <Space wrap>
                <Switch
                  checked={sku.isActive}
                  checkedChildren="启用"
                  unCheckedChildren="停用"
                  onChange={handleToggleActive}
                />
                {sku.productId && (
                  <Button size="small" icon={<PlusOutlined />} onClick={() => { setAddingSku(true); skuForm.resetFields(); }}>
                    添加 SKU
                  </Button>
                )}
                <Button size="small" icon={<EditOutlined />} onClick={() => {
                  setEditingSkuInfo(true);
                  infoForm.setFieldsValue({
                    skuName: sku.skuName,
                    spec: sku.spec,
                    salePrice: sku.salePrice,
                    costPrice: sku.costPrice,
                    weight: sku.weight,
                    brand: sku.brand,
                  });
                }}>
                  编辑信息
                </Button>
                <Popconfirm title="确认删除此 SKU?" onConfirm={handleDelete}>
                  <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </Space>

              {/* 添加 SKU 表单 */}
              {addingSku && (
                <div style={{ marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 8 }}>
                  <div style={{ fontWeight: 500, marginBottom: 8 }}>为此产品添加新 SKU</div>
                  <Form form={skuForm} layout="vertical" onFinish={handleAddSku}>
                    <Space wrap>
                      <Form.Item name="skuName" rules={[{ required: true, message: '请输入' }]} style={{ marginBottom: 8 }}>
                        <Input placeholder="SKU名称/规格" style={{ width: 160 }} />
                      </Form.Item>
                      <Form.Item name="spec" style={{ marginBottom: 8 }}>
                        <Input placeholder="规格描述" style={{ width: 140 }} />
                      </Form.Item>
                      <Form.Item name="salePrice" style={{ marginBottom: 8 }}>
                        <InputNumber placeholder="销售价" min={0} precision={2} style={{ width: 100 }} />
                      </Form.Item>
                      <Form.Item name="costPrice" style={{ marginBottom: 8 }}>
                        <InputNumber placeholder="成本价" min={0} precision={2} style={{ width: 100 }} />
                      </Form.Item>
                      <Form.Item name="weight" style={{ marginBottom: 8 }}>
                        <InputNumber placeholder="重量(kg)" min={0} precision={3} style={{ width: 100 }} />
                      </Form.Item>
                      <Form.Item name="brand" style={{ marginBottom: 8 }}>
                        <Input placeholder="品牌" style={{ width: 100 }} />
                      </Form.Item>
                    </Space>
                    <Form.Item name="pics" initialValue={[]} style={{ marginBottom: 8 }}>
                      <MultiImageUpload
                        maxCount={9}
                        onUpload={async (files) => {
                          const urls = files.map((f) => URL.createObjectURL(f));
                          const current = skuForm.getFieldValue('pics') || [];
                          skuForm.setFieldsValue({ pics: [...current, ...urls] });
                          return [...current, ...urls];
                        }}
                      />
                    </Form.Item>
                    <Space>
                      <Button size="small" onClick={() => setAddingSku(false)}>取消</Button>
                      <Button type="primary" size="small" htmlType="submit" loading={addingSkuLoading}>保存</Button>
                    </Space>
                  </Form>
                </div>
              )}

              {/* 编辑 SKU 信息表单 */}
              {editingSkuInfo && (
                <div style={{ marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 8 }}>
                  <div style={{ fontWeight: 500, marginBottom: 8 }}>编辑 SKU 信息</div>
                  <Form form={infoForm} layout="vertical" onFinish={handleSaveSkuInfo}>
                    <Space wrap>
                      <Form.Item name="skuName" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                        <Input placeholder="SKU名称" style={{ width: 160 }} />
                      </Form.Item>
                      <Form.Item name="spec" style={{ marginBottom: 8 }}>
                        <Input placeholder="规格" style={{ width: 140 }} />
                      </Form.Item>
                      <Form.Item name="salePrice" style={{ marginBottom: 8 }}>
                        <InputNumber placeholder="销售价" min={0} precision={2} style={{ width: 100 }} />
                      </Form.Item>
                      <Form.Item name="costPrice" style={{ marginBottom: 8 }}>
                        <InputNumber placeholder="成本价" min={0} precision={2} style={{ width: 100 }} />
                      </Form.Item>
                      <Form.Item name="weight" style={{ marginBottom: 8 }}>
                        <InputNumber placeholder="重量(kg)" min={0} precision={3} style={{ width: 100 }} />
                      </Form.Item>
                      <Form.Item name="brand" style={{ marginBottom: 8 }}>
                        <Input placeholder="品牌" style={{ width: 100 }} />
                      </Form.Item>
                    </Space>
                    <Space>
                      <Button size="small" onClick={() => setEditingSkuInfo(false)}>取消</Button>
                      <Button type="primary" size="small" htmlType="submit" loading={savingSkuInfo}>保存</Button>
                    </Space>
                  </Form>
                </div>
              )}
            </Card>

            {/* 库存 */}
            <Card
              size="small"
              title={<span><InboxOutlined /> 库存分布</span>}
              loading={loading}
            >
              {stocks.length > 0 ? (
                <Table
                  size="small"
                  columns={stockColumns}
                  dataSource={stocks}
                  pagination={false}
                  rowKey={(r: any) => `${r.skuId}-${r.warehouseId}`}
                />
              ) : (
                <Empty description="暂无库存数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>

            {/* BOM 结构 */}
            {(isFinished || sku?.itemType === 'semi_finished') && (
              <Card
                size="small"
                title={<span><BuildOutlined /> BOM 结构</span>}
                loading={loading}
                extra={
                  !editingBom && (
                    <Space>
                      {boms.length > 0 && (
                        <Button size="small" icon={<PlusOutlined />} onClick={() => {
                          setBomVersionMode('new');
                          bomForm.setFieldsValue({
                            version: `v${boms.length + 1}`,
                            remark: '',
                            items: [{ qty: 1, lossRate: 0 }],
                          });
                          setEditingBom(true);
                        }}>
                          新版本
                        </Button>
                      )}
                      <Button size="small" icon={<EditOutlined />} onClick={() => {
                        const activeBom = boms.find((b) => b.isActive);
                        setBomVersionMode('update');
                        bomForm.setFieldsValue({
                          version: activeBom?.version || 'v1',
                          remark: activeBom?.remark,
                          items: activeBom?.items?.map((i) => ({
                            materialSkuId: i.materialSkuId,
                            qty: i.qty,
                            lossRate: i.lossRate,
                            materialCategoryId: i.materialCategoryId,
                            remark: i.remark,
                          })) || [{ qty: 1, lossRate: 0 }],
                        });
                        setEditingBom(true);
                      }}>
                        {boms.length > 0 ? '编辑' : '配置'}
                      </Button>
                    </Space>
                  )
                }
              >
                {editingBom ? (
                  <Form form={bomForm} layout="vertical" onFinish={bomVersionMode === 'new' ? handleCreateBomVersion : handleSaveBom}>
                    <Space align="center">
                      <Form.Item name="version" label="版本" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                        <Input placeholder="v1" style={{ width: 100 }} />
                      </Form.Item>
                      <Form.Item name="remark" label="备注" style={{ marginBottom: 8 }}>
                        <Input placeholder="备注" style={{ width: 200 }} />
                      </Form.Item>
                      {bomVersionMode === 'new' && (
                        <Tag color="blue">创建新版本</Tag>
                      )}
                      {bomVersionMode === 'update' && (
                        <Tag color="orange">更新现有版本</Tag>
                      )}
                    </Space>

                    <Form.List name="items">
                      {(fields, { add, remove }) => (
                        <div>
                          {fields.map((field, index) => (
                            <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                              <Form.Item
                                {...field}
                                name={[field.name, 'materialSkuId']}
                                rules={[{ required: true, message: '选物料' }]}
                                style={{ marginBottom: 0 }}
                              >
                                <Select
                                  placeholder="选择物料"
                                  showSearch
                                  optionFilterProp="children"
                                  style={{ width: 160 }}
                                  options={allMaterialSkus.map((s) => ({
                                    label: `${s.skuName || s.skuCode || s.id} (${s.itemType === 'raw_material' ? '原材料' : s.itemType === 'packaging' ? '包材' : '半成品'})`,
                                    value: s.id,
                                  }))}
                                />
                              </Form.Item>
                              <Button
                                type="link"
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={() => {
                                  setPendingSelectIndex(index);
                                  setQuickCreateOpen(true);
                                }}
                              >
                                新建
                              </Button>
                              <Form.Item
                                {...field}
                                name={[field.name, 'qty']}
                                rules={[{ required: true, message: '用量' }]}
                                style={{ marginBottom: 0 }}
                              >
                                <InputNumber placeholder="用量" min={0.01} step={0.01} style={{ width: 80 }} />
                              </Form.Item>
                              <Form.Item
                                {...field}
                                name={[field.name, 'lossRate']}
                                style={{ marginBottom: 0 }}
                              >
                                <InputNumber placeholder="损耗%" min={0} max={100} style={{ width: 70 }} />
                              </Form.Item>
                              <Form.Item
                                {...field}
                                name={[field.name, 'materialCategoryId']}
                                style={{ marginBottom: 0 }}
                              >
                                <Select placeholder="分类" allowClear style={{ width: 100 }}>
                                  {materialCategories.map((c) => (
                                    <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>
                                  ))}
                                </Select>
                              </Form.Item>
                              <Button type="link" danger onClick={() => remove(field.name)}>
                                删除
                              </Button>
                            </Space>
                          ))}
                          <Button type="dashed" onClick={() => add({ qty: 1, lossRate: 0 })} block icon={<PlusOutlined />} size="small">
                            添加子物料
                          </Button>
                        </div>
                      )}
                    </Form.List>

                    <Space style={{ marginTop: 12 }}>
                      <Button size="small" onClick={() => setEditingBom(false)}>取消</Button>
                      <Button type="primary" size="small" htmlType="submit" loading={savingBom}>保存</Button>
                    </Space>
                  </Form>
                ) : boms.length > 0 ? (
                  <div>
                    {boms.map((bom) => (
                      <div key={bom.id} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                          版本: {bom.version} {bom.isActive ? <Tag color="green">生效</Tag> : <Tag>停用</Tag>}
                        </div>
                        <Table
                          size="small"
                          dataSource={bom.items || []}
                          pagination={false}
                          rowKey="id"
                          columns={[
                            {
                              title: '子物料',
                              dataIndex: 'materialSkuId',
                              render: (v: string) => {
                                const matched = allMaterialSkus.find((s) => s.id === v);
                                return matched ? `${matched.skuName || matched.skuCode || v}` : v;
                              },
                            },
                            { title: '用量', dataIndex: 'qty', render: (v: number) => Number(v).toFixed(2) },
                            { title: '损耗%', dataIndex: 'lossRate', render: (v: number) => `${v || 0}%` },
                          ]}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description="暂无 BOM 数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            )}
          </div>
        )}
      </Drawer>

      <QuickCreateMaterialModal
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onCreated={handleMaterialCreated}
      />
    </>
  );
}
