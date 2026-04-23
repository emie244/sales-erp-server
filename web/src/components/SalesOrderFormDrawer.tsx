import { useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  Select,
  Button,
  message,
  InputNumber,
  Input,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { fetchCustomers, fetchCustomerById } from '@/api/customers';
import { fetchProducts, fetchSkus } from '@/api/products';
import { fetchUsers } from '@/api/users';
import { createSalesOrder, updateSalesOrder } from '@/api/sales';
import RegionCascader from './RegionCascader';
import { parseAddress } from '@/utils/addressParser';
import type { SalesOrder } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingOrder?: SalesOrder | null;
}

const orderTypeOptions = [
  { label: '销售订单', value: 'sales' },
  { label: '海外提货单', value: 'overseas' },
];

const filterOption = (
  input: string,
  option?: { label: string; value: string },
) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase());

export default function SalesOrderFormDrawer({
  open,
  onClose,
  onSuccess,
  editingOrder,
}: Props) {
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [skuMap, setSkuMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCustomers()
        .then((res) => setCustomers(res.data))
        .catch(() => {});
      fetchProducts()
        .then((res) => setProducts(res.data))
        .catch(() => {});
      fetchUsers()
        .then(setUsers)
        .catch(() => {});

      if (editingOrder) {
        // 填充编辑数据
        const items = editingOrder.items?.map((item: any, index: number) => {
          // 异步加载SKU
          if (item.skuId) {
            fetchProducts().then((res) => {
              const products = res.data || [];
              const product = products.find((p: any) =>
                p.skus?.some((s: any) => s.id === item.skuId),
              );
              if (product) {
                fetchSkus(product.id).then((skus) => {
                  setSkuMap((prev) => ({ ...prev, [index]: skus }));
                });
              }
            });
          }
          return {
            productId: item.productId || '',
            skuId: item.skuId,
            qty: item.qty,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount || 0,
            lineAmount: item.lineAmount,
          };
        }) || [{ productIndex: 0 }];

        // 处理地址：如果省市区为空，尝试从详细地址解析
        let region = [
          editingOrder.consigneeProvince,
          editingOrder.consigneeCity,
          editingOrder.consigneeDistrict,
        ].filter(Boolean);

        if (region.length === 0 && editingOrder.consigneeAddress) {
          const parsed = parseAddress(editingOrder.consigneeAddress);
          if (parsed) {
            region = [parsed.province, parsed.city, parsed.district].filter(
              Boolean,
            );
          }
        }

        form.setFieldsValue({
          type: editingOrder.type,
          signerId: editingOrder.signerId,
          customerId: editingOrder.customerId,
          consignee: editingOrder.consignee,
          consigneePhone: editingOrder.consigneePhone,
          consigneeAddress: editingOrder.consigneeAddress,
          region,
          items,
          totalAmount: editingOrder.totalAmount,
          payAmount: editingOrder.payAmount,
          remark: editingOrder.remark,
        });
      } else {
        form.resetFields();
        setSkuMap({});
      }
    }
  }, [open, form, editingOrder]);

  const handleCustomerChange = async (customerId: string) => {
    if (!customerId) return;
    try {
      const customer = await fetchCustomerById(customerId);
      form.setFieldsValue({
        consignee: customer.contactName || '',
        consigneePhone: customer.phone || '',
        consigneeAddress: customer.address || '',
      });
    } catch {
      // ignore
    }
  };

  const handleProductChange = (productId: string, index: number) => {
    fetchSkus(productId)
      .then((list) => {
        setSkuMap((prev) => ({ ...prev, [index]: list }));
        if (list.length > 0) {
          form.setFieldValue(['items', index, 'skuId'], list[0].id);
        } else {
          form.setFieldValue(['items', index, 'skuId'], undefined);
          message.warning('该产品暂无 SKU，请先在产品管理中补充');
        }
        recalcLineAmount(index);
      })
      .catch(() => {});
  };

  const recalcLineAmount = (index: number) => {
    const items = form.getFieldValue('items') || [];
    const item = items[index];
    if (!item) return;
    const qty = Number(item.qty) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const discount = Number(item.discountAmount) || 0;
    const lineAmount = qty * unitPrice - discount;
    form.setFieldValue(['items', index, 'lineAmount'], lineAmount);
    recalcTotal();
  };

  const recalcTotal = () => {
    const items = form.getFieldValue('items') || [];
    const total = items.reduce((sum: number, it: any) => {
      const line = Number(it?.lineAmount) || 0;
      return sum + line;
    }, 0);
    form.setFieldsValue({
      totalAmount: total,
      payAmount: total,
    });
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const allSkus = Object.values(skuMap).flat();
      const items = values.items.map((item: any) => {
        const sku = allSkus.find((s: any) => s.id === item.skuId);
        return {
          productId: item.productId,
          skuId: item.skuId,
          skuName: sku?.skuName || sku?.skuCode || '',
          qty: item.qty,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount || 0,
          lineAmount: item.lineAmount,
        };
      });

      // 解析级联地址
      const regionValue = values.region || [];
      const payload = {
        customerId: values.customerId,
        type: values.type,
        signerId: values.signerId,
        totalAmount: values.totalAmount,
        payAmount: values.payAmount,
        items,
        remark: values.remark,
        consignee: values.consignee,
        consigneePhone: values.consigneePhone,
        consigneeTel: values.consigneeTel,
        consigneeAddress: values.consigneeAddress,
        consigneeProvince: regionValue[0] || '',
        consigneeCity: regionValue[1] || '',
        consigneeDistrict: regionValue[2] || '',
        consigneeTown: values.consigneeTown || '',
        logisticsCompany: values.logisticsCompany,
        expressNo: values.expressNo,
        buyerMessage: values.buyerMessage,
        attachments: [],
      };

      if (editingOrder) {
        await updateSalesOrder(editingOrder.id, payload);
        message.success('修改成功');
      } else {
        await createSalesOrder(payload);
        message.success('创建成功');
      }
      onSuccess();
      onClose();
    } catch {
      message.error(editingOrder ? '修改失败' : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const productOptions = products.map((p) => ({
    label: p.name,
    value: p.id,
  }));

  const tableHeaderStyle: React.CSSProperties = {
    display: 'flex',
    fontWeight: 500,
    fontSize: 13,
    color: '#666',
    padding: '8px 4px',
    borderBottom: '1px solid #f0f0f0',
    marginBottom: 8,
  };

  const tableRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 0',
  };

  const colStyle = (width: number): React.CSSProperties => ({
    width,
    flexShrink: 0,
  });

  return (
    <Drawer
      title={editingOrder ? '编辑销售订单' : '新建销售订单'}
      width={800}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label="订单类型"
          name="type"
          initialValue="sales"
          rules={[{ required: true, message: '请选择订单类型' }]}
        >
          <Select placeholder="请选择订单类型" options={orderTypeOptions} />
        </Form.Item>

        <Form.Item
          label="签单人"
          name="signerId"
          rules={[{ required: true, message: '请选择签单人' }]}
        >
          <Select
            placeholder="请选择签单人"
            showSearch
            filterOption={filterOption}
            options={users.map((u) => ({ label: u.name, value: u.id }))}
          />
        </Form.Item>

        <Form.Item
          label="客户名称"
          name="customerId"
          rules={[{ required: true, message: '请选择客户' }]}
        >
          <Select
            placeholder="请选择客户"
            showSearch
            filterOption={filterOption}
            options={customers.map((c) => ({ label: c.name, value: c.id }))}
            onChange={handleCustomerChange}
          />
        </Form.Item>

        <Form.Item
          label="收货人"
          name="consignee"
          rules={[{ required: true, message: '请填写收货人' }]}
        >
          <Input placeholder="收货人" />
        </Form.Item>

        <Form.Item
          label="收货电话"
          name="consigneePhone"
          rules={[{ required: true, message: '请填写收货电话' }]}
        >
          <Input placeholder="收货电话" />
        </Form.Item>

        <Form.Item
          label="收货地址（省/市/区）"
          name="region"
          rules={[{ required: true, message: '请选择省/市/区' }]}
        >
          <RegionCascader placeholder="请选择省/市/区" />
        </Form.Item>

        <Form.Item
          label="详细地址"
          name="consigneeAddress"
          rules={[{ required: true, message: '请填写详细地址' }]}
        >
          <Input.TextArea
            rows={2}
            placeholder="请填写包含省/市/区的完整地址，系统将自动识别"
            onBlur={(e) => {
              const address = e.target.value;
              if (!address) return;

              const currentRegion = form.getFieldValue('region');
              // 如果用户已经手动选择了省市区，不自动覆盖
              if (currentRegion && currentRegion.length > 0) return;

              const parsed = parseAddress(address);
              if (parsed) {
                form.setFieldsValue({
                  region: [parsed.province, parsed.city, parsed.district],
                });
                message.success('已自动识别省/市/区');
              }
            }}
          />
        </Form.Item>

        <Form.Item label="产品明细" required>
          <Form.List name="items" initialValue={[{ productIndex: 0 }]}>
            {(fields, { add, remove }) => (
              <div>
                {/* 表头 */}
                <div style={tableHeaderStyle}>
                  <div style={colStyle(140)}>商品</div>
                  <div style={colStyle(160)}>规格型号</div>
                  <div style={colStyle(70)}>数量</div>
                  <div style={colStyle(90)}>单价</div>
                  <div style={colStyle(70)}>折扣</div>
                  <div style={colStyle(90)}>小计</div>
                  <div style={colStyle(50)}></div>
                </div>

                {/* 数据行 */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {fields.map(({ key, name, ...restField }) => (
                    <div key={key} style={tableRowStyle}>
                      <div style={colStyle(140)}>
                        <Form.Item
                          {...restField}
                          name={[name, 'productId']}
                          rules={[{ required: true, message: '选商品' }]}
                          noStyle
                        >
                          <Select
                            placeholder="选择商品"
                            showSearch
                            filterOption={filterOption}
                            options={productOptions}
                            onChange={(v) => handleProductChange(v, name)}
                          />
                        </Form.Item>
                      </div>
                      <div style={colStyle(160)}>
                        <Form.Item
                          {...restField}
                          name={[name, 'skuId']}
                          rules={[{ required: true, message: '选SKU' }]}
                          noStyle
                        >
                          <Select
                            placeholder="选择规格型号"
                            showSearch
                            filterOption={filterOption}
                            options={(skuMap[name] || []).map((s: any) => ({
                              label: s.skuName || s.skuCode || s.jstSkuId,
                              value: s.id,
                            }))}
                          />
                        </Form.Item>
                      </div>
                      <div style={colStyle(70)}>
                        <Form.Item
                          {...restField}
                          name={[name, 'qty']}
                          rules={[{ required: true, message: '数量' }]}
                          noStyle
                        >
                          <InputNumber
                            placeholder="数量"
                            min={1}
                            style={{ width: '100%' }}
                            onChange={() => recalcLineAmount(name)}
                          />
                        </Form.Item>
                      </div>
                      <div style={colStyle(90)}>
                        <Form.Item
                          {...restField}
                          name={[name, 'unitPrice']}
                          rules={[{ required: true, message: '单价' }]}
                          noStyle
                        >
                          <InputNumber
                            placeholder="单价"
                            min={0}
                            precision={2}
                            prefix="¥"
                            style={{ width: '100%' }}
                            onChange={() => recalcLineAmount(name)}
                          />
                        </Form.Item>
                      </div>
                      <div style={colStyle(70)}>
                        <Form.Item
                          {...restField}
                          name={[name, 'discountAmount']}
                          initialValue={0}
                          noStyle
                        >
                          <InputNumber
                            placeholder="折扣"
                            min={0}
                            precision={2}
                            prefix="¥"
                            style={{ width: '100%' }}
                            onChange={() => recalcLineAmount(name)}
                          />
                        </Form.Item>
                      </div>
                      <div style={colStyle(90)}>
                        <Form.Item
                          {...restField}
                          name={[name, 'lineAmount']}
                          noStyle
                        >
                          <InputNumber
                            placeholder="小计"
                            readOnly
                            precision={2}
                            prefix="¥"
                            style={{
                              width: '100%',
                              background: '#f5f5f5',
                            }}
                          />
                        </Form.Item>
                      </div>
                      <div style={colStyle(50)}>
                        <Button
                          type="link"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(name)}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="dashed"
                  onClick={() => add({ productIndex: fields.length })}
                  block
                  style={{ marginTop: 12 }}
                >
                  <PlusOutlined /> 添加商品
                </Button>
              </div>
            )}
          </Form.List>
        </Form.Item>

        <div
          style={{
            display: 'flex',
            gap: 24,
            background: '#f6ffed',
            padding: 16,
            borderRadius: 4,
            marginBottom: 16,
          }}
        >
          <Form.Item
            label="订单总金额"
            name="totalAmount"
            style={{ marginBottom: 0 }}
          >
            <InputNumber
              readOnly
              style={{ width: 140, background: '#f5f5f5' }}
              precision={2}
              prefix="¥"
            />
          </Form.Item>
          <Form.Item
            label="应付金额"
            name="payAmount"
            style={{ marginBottom: 0 }}
          >
            <InputNumber
              readOnly
              style={{ width: 140, background: '#f5f5f5' }}
              precision={2}
              prefix="¥"
            />
          </Form.Item>
        </div>

        <Form.Item label="备注" name="remark">
          <Input.TextArea rows={3} placeholder="请输入备注" />
        </Form.Item>

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
