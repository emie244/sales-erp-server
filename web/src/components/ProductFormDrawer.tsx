import { useState, useEffect } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  Button,
  Space,
  InputNumber,
  Divider,
  Steps,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import axios from '@/api/axios';
import { createProduct, fetchProducts, fetchAllSkus } from '@/api/products';
import MultiImageUpload from './MultiImageUpload';
import QuickCreateMaterialModal from './QuickCreateMaterialModal';
import { fetchMaterialCategories } from '@/api/material-categories';
import type { MaterialCategory } from '@/api/material-categories';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ITEM_TYPE_OPTIONS = [
  { label: '成品', value: 'finished_good' },
  { label: '半成品', value: 'semi_finished' },
  { label: '原材料', value: 'raw_material' },
  { label: '包材', value: 'packaging' },
];

export default function ProductFormDrawer({ open, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [itemType, setItemType] = useState('finished_good');
  const [, setMaterialCategories] = useState<MaterialCategory[]>([]);
  const [allMaterialSkus, setAllMaterialSkus] = useState<{ id: string; skuName?: string; skuCode?: string; itemType?: string }[]>([]);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [pendingSelectIndex, setPendingSelectIndex] = useState<number | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setStep(0);
    setItemType('finished_good');
    fetchMaterialCategories().then(setMaterialCategories).catch(() => {});

    // 加载现有分类和品牌作为下拉选项
    Promise.all([
      fetchProducts({ pageSize: 1000 }),
      fetchAllSkus({ pageSize: 1000 }),
    ]).then(([productRes, skuRes]) => {
      const cats = new Set<string>();
      const brands = new Set<string>();
      productRes.data?.forEach((p: any) => { if (p.category) cats.add(p.category); });
      skuRes.data?.forEach((s: any) => { if (s.brand) brands.add(s.brand); });
      setCategoryOptions(Array.from(cats).sort());
      setBrandOptions(Array.from(brands).sort());
    }).catch(() => {});
  }, [open, form]);

  const handleTypeChange = (v: string) => {
    setItemType(v);
    form.setFieldsValue({ itemType: v });
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const isMaterial = values.itemType !== 'finished_good';
      const productName = values.name || values.skuName;
      if (!productName) {
        message.error('请输入名称');
        setLoading(false);
        return;
      }

      const payload: any = {
        name: productName,
        category: values.category,
        itemType: values.itemType,
        lifecycleStage: isMaterial ? undefined : values.lifecycleStage,
        skus: [
          {
            skuName: values.skuName || values.name,
            spec: values.spec,
            salePrice: values.salePrice,
            costPrice: values.costPrice,
            weight: values.weight,
            pics: values.pics || [],
            pic: values.pics?.[0],
            brand: values.brand,
            itemType: values.itemType,
          },
        ],
      };

      const product = await createProduct(payload, { mode: 'quick' });
      const skuId = product.skus?.[0]?.id;

      // 如果配置了BOM，创建BOM
      if (skuId && values.bomItems?.length > 0 && (values.itemType === 'finished_good' || values.itemType === 'semi_finished')) {
        const validItems = values.bomItems.filter((i: any) => i.materialSkuId && i.qty > 0);
        if (validItems.length > 0) {
          await axios.post('/boms', {
            productId: product.id,
            skuId,
            version: values.bomVersion || 'v1',
            items: validItems.map((i: any) => ({
              materialSkuId: i.materialSkuId,
              qty: i.qty,
              lossRate: i.lossRate || 0,
              materialCategoryId: i.materialCategoryId,
              remark: i.remark,
            })),
          });
        }
      }

      message.success('创建成功');
      onSuccess();
      onClose();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMaterialCreated = (newMaterial: { id: string; skuName: string; skuCode: string }) => {
    setAllMaterialSkus((prev) => [...prev, { ...newMaterial, itemType: 'raw_material' }]);
    if (pendingSelectIndex !== null) {
      const items = form.getFieldValue('bomItems') || [];
      items[pendingSelectIndex] = { ...items[pendingSelectIndex], materialSkuId: newMaterial.id };
      form.setFieldsValue({ bomItems: items });
      setPendingSelectIndex(null);
    }
  };

  const isFinished = itemType === 'finished_good';
  const isSemi = itemType === 'semi_finished';
  const showBomStep = isFinished || isSemi;

  const steps = [
    { title: '基础信息' },
    { title: 'SKU信息' },
    ...(showBomStep ? [{ title: 'BOM配置' }] : []),
  ];

  return (
    <>
      <Drawer
        title="新建产品/物料"
        width={720}
        open={open}
        onClose={onClose}
        destroyOnClose
      >
        <Steps current={step} size="small" style={{ marginBottom: 24 }} items={steps} />

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {step === 0 && (
            <>
              <Form.Item label="物料类型" name="itemType" initialValue="finished_good">
                <Select options={ITEM_TYPE_OPTIONS} onChange={handleTypeChange} />
              </Form.Item>
              <Form.Item
                label={isFinished ? '产品名称' : '物料名称'}
                name="name"
                rules={[{ required: true, message: '请输入名称' }]}
              >
                <Input placeholder={isFinished ? '如：拍拍小夜灯' : '如：锂电池 10000mAh'} />
              </Form.Item>
              {isFinished && (
                <>
                  <Form.Item label="产品分类" name="category">
                    <Select
                      placeholder="选择或输入分类"
                      showSearch
                      allowClear
                      options={categoryOptions.map((c) => ({ label: c, value: c }))}
                      dropdownRender={(menu) => (
                        <>
                          {menu}
                          {categoryOptions.length === 0 && (
                            <div style={{ padding: '8px 12px', color: '#999', fontSize: 12 }}>
                              暂无现有分类，可直接输入
                            </div>
                          )}
                        </>
                      )}
                    />
                  </Form.Item>
                  <Form.Item label="品牌" name="brand">
                    <Select
                      placeholder="选择或输入品牌"
                      showSearch
                      allowClear
                      options={brandOptions.map((b) => ({ label: b, value: b }))}
                      dropdownRender={(menu) => (
                        <>
                          {menu}
                          {brandOptions.length === 0 && (
                            <div style={{ padding: '8px 12px', color: '#999', fontSize: 12 }}>
                              暂无现有品牌，可直接输入
                            </div>
                          )}
                        </>
                      )}
                    />
                  </Form.Item>
                  <Form.Item label="生命周期" name="lifecycleStage">
                    <Select
                      placeholder="请选择"
                      allowClear
                      options={[
                        { label: '概念期', value: 'concept' },
                        { label: '上市期', value: 'launching' },
                        { label: '新品', value: 'new' },
                        { label: '成长期', value: 'growth' },
                        { label: '成熟期', value: 'mature' },
                        { label: '衰退期', value: 'decline' },
                        { label: '停产', value: 'discontinued' },
                      ]}
                    />
                  </Form.Item>
                </>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <Form.Item
                label={isFinished ? 'SKU规格名称' : '物料名称'}
                name="skuName"
                rules={[{ required: true }]}
              >
                <Input placeholder={isFinished ? '如：黑色 10000mAh' : '规格描述'} />
              </Form.Item>
              <Form.Item label="规格" name="spec">
                <Input placeholder="如：10000mAh / 黑色" />
              </Form.Item>
              <Space>
                {isFinished && (
                  <Form.Item label="销售价" name="salePrice">
                    <InputNumber placeholder="¥" min={0} precision={2} style={{ width: 140 }} />
                  </Form.Item>
                )}
                <Form.Item label="成本价" name="costPrice">
                  <InputNumber placeholder="¥" min={0} precision={2} style={{ width: 140 }} />
                </Form.Item>
                <Form.Item label="重量(kg)" name="weight">
                  <InputNumber placeholder="kg" min={0} precision={3} style={{ width: 140 }} />
                </Form.Item>
              </Space>
              <Form.Item label="图片" name="pics" initialValue={[]}>
                <MultiImageUpload
                  maxCount={9}
                  onUpload={async (files) => {
                    const urls = files.map((f) => URL.createObjectURL(f));
                    const current = form.getFieldValue('pics') || [];
                    form.setFieldsValue({ pics: [...current, ...urls] });
                    return [...current, ...urls];
                  }}
                />
              </Form.Item>
            </>
          )}

          {step === 2 && showBomStep && (
            <>
              <Form.Item name="bomVersion" label="BOM版本" initialValue="v1">
                <Input placeholder="v1" style={{ width: 100 }} />
              </Form.Item>
              <Divider>子物料清单（可跳过）</Divider>
              <Form.List name="bomItems">
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
                            style={{ width: 180 }}
                            options={allMaterialSkus.map((s) => ({
                              label: `${s.skuName || s.skuCode || s.id}`,
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
                          rules={[{ required: true }]}
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
                        <Button type="link" danger onClick={() => remove(field.name)}>
                          删除
                        </Button>
                      </Space>
                    ))}
                    <Button
                      type="dashed"
                      onClick={() => add({ qty: 1, lossRate: 0 })}
                      block
                      icon={<PlusOutlined />}
                      size="small"
                    >
                      添加子物料
                    </Button>
                  </div>
                )}
              </Form.List>
            </>
          )}
        </Form>

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 24px', borderTop: '1px solid #f0f0f0', background: '#fff', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {step > 0 && (
            <Button onClick={() => setStep(step - 1)}>上一步</Button>
          )}
          {step < steps.length - 1 ? (
            <Button type="primary" onClick={() => setStep(step + 1)}>
              下一步
            </Button>
          ) : (
            <Button type="primary" loading={loading} onClick={() => form.submit()}>
              保存
            </Button>
          )}
          <Button onClick={onClose}>取消</Button>
        </div>
      </Drawer>

      <QuickCreateMaterialModal
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        onCreated={handleMaterialCreated}
      />
    </>
  );
}
