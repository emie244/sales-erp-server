import React, { useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  Button,
  Space,
  message,
  InputNumber,
} from 'antd';
import { fetchCustomers } from '@/api/customers';
import { fetchProducts, fetchSkus } from '@/api/products';
import { createSalesOrder } from '@/api/sales';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SalesOrderFormDrawer({
  open,
  onClose,
  onSuccess,
}: Props) {
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [skus, setSkus] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCustomers()
        .then(setCustomers)
        .catch(() => {});
      fetchProducts()
        .then(setProducts)
        .catch(() => {});
      form.resetFields();
    }
  }, [open]);

  const handleProductChange = (productId: string) => {
    fetchSkus(productId)
      .then(setSkus)
      .catch(() => {});
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const items = values.items.map((item: any) => {
        const sku = skus.find((s) => s.id === item.skuId);
        return {
          skuId: item.skuId,
          skuName: sku?.skuName || '',
          qty: item.qty,
          unitPrice: item.unitPrice,
          lineAmount: item.qty * item.unitPrice,
        };
      });
      await createSalesOrder({
        customerId: values.customerId,
        payAmount: items.reduce((sum: number, i: any) => sum + i.lineAmount, 0),
        items,
      });
      message.success('创建成功');
      onSuccess();
      onClose();
    } catch {
      message.error('创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      title="新建销售订单"
      width={520}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="客户" name="customerId" rules={[{ required: true }]}>
          <Select
            placeholder="请选择客户"
            options={customers.map((c) => ({ label: c.name, value: c.id }))}
          />
        </Form.Item>
        <Form.List name="items" initialValue={[{}]}>
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Space
                  key={key}
                  style={{ display: 'flex', marginBottom: 8 }}
                  align="baseline"
                >
                  <Form.Item
                    {...restField}
                    name={[name, 'productId']}
                    rules={[{ required: true, message: '选商品' }]}
                  >
                    <Select
                      placeholder="商品"
                      style={{ width: 120 }}
                      options={products.map((p) => ({
                        label: p.name,
                        value: p.id,
                      }))}
                      onChange={handleProductChange}
                    />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'skuId']}
                    rules={[{ required: true, message: '选SKU' }]}
                  >
                    <Select
                      placeholder="SKU"
                      style={{ width: 120 }}
                      options={skus.map((s) => ({
                        label: s.skuName,
                        value: s.id,
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'qty']}
                    rules={[{ required: true, message: '数量' }]}
                  >
                    <InputNumber placeholder="数量" min={1} />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'unitPrice']}
                    rules={[{ required: true, message: '单价' }]}
                  >
                    <InputNumber placeholder="单价" min={0} precision={2} />
                  </Form.Item>
                  <Button type="link" danger onClick={() => remove(name)}>
                    删除
                  </Button>
                </Space>
              ))}
              <Button type="dashed" onClick={() => add()} block>
                + 添加商品
              </Button>
            </>
          )}
        </Form.List>
        <div style={{ textAlign: 'right', marginTop: 24 }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>
            取消
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存
          </Button>
        </div>
      </Form>
    </Drawer>
  );
}
