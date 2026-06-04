import { useState } from 'react';
import { Modal, Form, Input, InputNumber, Select, message } from 'antd';
import { createProduct } from '@/api/products';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (sku: { id: string; skuName: string; skuCode: string }) => void;
}

const materialTypeOptions = [
  { label: '原材料', value: 'raw_material' },
  { label: '包材', value: 'packaging' },
];

export default function QuickCreateMaterialModal({
  open,
  onClose,
  onCreated,
}: Props) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        category: values.category,
        itemType: values.itemType || 'raw_material',
        skus: [
          {
            skuName: values.name,
            costPrice: values.costPrice,
            weight: values.weight,
            itemType: values.itemType || 'raw_material',
          },
        ],
      };
      const product = await createProduct(payload, { mode: 'quick' });
      const sku = product.skus?.[0];
      if (!sku) {
        throw new Error('创建失败，未返回SKU');
      }
      message.success('物料创建成功');
      onCreated({
        id: sku.id,
        skuName: sku.skuName || sku.skuCode || '',
        skuCode: sku.skuCode || sku.skuName || '',
      });
      form.resetFields();
      onClose();
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="快速新建物料"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      width={480}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label="物料类型"
          name="itemType"
          initialValue="raw_material"
          rules={[{ required: true }]}
        >
          <Select options={materialTypeOptions} />
        </Form.Item>
        <Form.Item
          label="物料名称"
          name="name"
          rules={[{ required: true, message: '请输入物料名称' }]}
        >
          <Input placeholder="如：锂电池 10000mAh" />
        </Form.Item>
        <Form.Item label="分类" name="category">
          <Input placeholder="物料分类" />
        </Form.Item>
        <Form.Item label="成本价" name="costPrice">
          <InputNumber
            placeholder="¥"
            min={0}
            precision={2}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label="重量(kg)" name="weight">
          <InputNumber
            placeholder="kg"
            min={0}
            precision={3}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
