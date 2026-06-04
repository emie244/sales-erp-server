import { useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  Select,
  Button,
  message,
  InputNumber,
  Input,
  DatePicker,
} from 'antd';
import dayjs from 'dayjs';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  fetchCustomers,
  fetchCustomerById,
  fetchCustomerAddresses,
} from '@/api/customers';
import { fetchProducts, fetchSkus, fetchSkuById } from '@/api/products';
import { fetchUsers } from '@/api/users';
import { createSalesOrder, updateSalesOrder } from '@/api/sales';
import RegionCascader from './RegionCascader';
import { parseAddress } from '@/utils/addressParser';
import AiOrderInput from './AiOrderInput';
import CustomerRecommendationPanel from './CustomerRecommendationPanel';
import type { SalesOrder } from '@/types';
import type { OrderDraft } from '@/api/ai';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingOrder?: SalesOrder | null;
  aiDraft?: OrderDraft | null;
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
  aiDraft,
}: Props) {
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [skuMap, setSkuMap] = useState<Record<string, any[]>>({});
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const customerId = Form.useWatch('customerId', form);

  useEffect(() => {
    if (!open) return;

    const initialize = async () => {
      const [customersRes, productsRes, usersRes] = await Promise.all([
        fetchCustomers()
          .then((res) => res.data)
          .catch(() => []),
        fetchProducts({ pageSize: 1000 })
          .then((res) => res.data)
          .catch(() => []),
        fetchUsers().catch(() => []),
      ]);

      setCustomers(customersRes);
      setProducts(productsRes);
      setUsers(usersRes);

      if (editingOrder) {
        // 填充编辑数据
        const items = editingOrder.items?.map((item: any) => ({
          productId: item.productId || '',
          skuId: item.skuId,
          qty: item.qty,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount || 0,
          lineAmount: item.lineAmount,
        })) || [
          {
            productId: '',
            skuId: '',
            qty: 1,
            unitPrice: 0,
            discountAmount: 0,
            lineAmount: 0,
          },
        ];

        // 如果 productId 缺失但 skuId 存在，从已加载的商品中反查 productId；
        // 若仍未找到，则调用接口通过 skuId 获取 productId
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (!item.productId && item.skuId) {
            const product = productsRes.find((p: any) =>
              p.skus?.some((s: any) => s.id === item.skuId),
            );
            if (product) {
              item.productId = product.id;
            } else {
              try {
                const sku = await fetchSkuById(item.skuId);
                if (sku?.productId) {
                  item.productId = sku.productId;
                }
              } catch {
                // 忽略单条 SKU 查询失败
              }
            }
          }
        }

        // 并行加载所有 SKU 列表
        const skuPromises = items.map(async (item: any, i: number) => {
          if (item.productId) {
            try {
              const skus = await fetchSkus(item.productId);
              return { index: i, skus };
            } catch {
              return { index: i, skus: [] };
            }
          }
          return null;
        });
        const skuResults = (await Promise.all(skuPromises)).filter(Boolean);
        const newSkuMap: Record<string, any[]> = {};
        skuResults.forEach((r: any) => {
          newSkuMap[r.index] = r.skus;
        });
        setSkuMap(newSkuMap);

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

        // 所有引用数据加载完成后再设置表单值，确保 Select 能正确匹配 label
        form.setFieldsValue({
          type: editingOrder.type,
          salespersonId: editingOrder.salespersonId,
          customerId: editingOrder.customerId,
          consignee: editingOrder.consignee,
          consigneePhone: editingOrder.consigneePhone,
          consigneeAddress: editingOrder.consigneeAddress,
          region,
          items,
          totalAmount: editingOrder.totalAmount,
          payAmount: editingOrder.payAmount,
          remark: editingOrder.remark,
          deliveryDate: editingOrder.deliveryDate ? dayjs(editingOrder.deliveryDate) : null,
          invoiceDate: editingOrder.invoiceDate ? dayjs(editingOrder.invoiceDate) : null,
          paymentDueDate: editingOrder.paymentDueDate ? dayjs(editingOrder.paymentDueDate) : null,
        });

        // 加载客户地址列表
        if (editingOrder.customerId) {
          fetchCustomerAddresses(editingOrder.customerId)
            .then((list) => setAddresses(list))
            .catch(() => setAddresses([]));
        }
      } else if (aiDraft) {
        // AI 草稿填充
        form.setFieldsValue({
          type: aiDraft.type,
          customerId: aiDraft.customerId,
          remark: aiDraft.remark,
          deliveryDate: aiDraft.deliveryDate ? dayjs(aiDraft.deliveryDate) : null,
          totalAmount: aiDraft.totalAmount,
          payAmount: aiDraft.payAmount,
        });

        // 触发客户变化加载地址
        if (aiDraft.customerId) {
          handleCustomerChange(aiDraft.customerId);
        }

        // 并行加载 SKU 列表
        const skuPromises = aiDraft.items.map(async (item, index) => {
          try {
            const skus = await fetchSkus(item.productId);
            return { index, skus };
          } catch {
            return { index, skus: [] };
          }
        });

        Promise.all(skuPromises).then((skuResults) => {
          const newSkuMap: Record<string, any[]> = {};
          skuResults.forEach((r) => {
            newSkuMap[r.index] = r.skus;
          });
          setSkuMap(newSkuMap);

          const formItems = aiDraft.items.map((item) => ({
            productId: item.productId,
            skuId: item.skuId,
            qty: item.qty,
            unitPrice: item.unitPrice,
            discountAmount: 0,
            lineAmount: item.lineAmount,
          }));

          form.setFieldValue('items', formItems);
        });
      } else {
        form.resetFields();
        setSkuMap({});
      }
    };

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form, editingOrder, aiDraft]);

  const handleCustomerChange = async (customerId: string) => {
    if (!customerId) {
      setAddresses([]);
      return;
    }
    try {
      const [customer, addrList] = await Promise.all([
        fetchCustomerById(customerId),
        fetchCustomerAddresses(customerId),
      ]);
      setAddresses(addrList);

      const defaultAddr = addrList.find((a: any) => a.isDefault) || addrList[0];
      if (defaultAddr) {
        form.setFieldsValue({
          consignee: defaultAddr.consignee || customer.contactName || '',
          consigneePhone: defaultAddr.phone || customer.phone || '',
          consigneeAddress: defaultAddr.detailAddress || customer.address || '',
          region: [
            defaultAddr.province,
            defaultAddr.city,
            defaultAddr.district,
          ].filter(Boolean),
          addressId: defaultAddr.id,
        });
      } else {
        form.setFieldsValue({
          consignee: customer.contactName || '',
          consigneePhone: customer.phone || '',
          consigneeAddress: customer.address || '',
          region: [],
          addressId: undefined,
        });
      }
    } catch {
      setAddresses([]);
    }
  };

  const handleAddressChange = (addressId: string) => {
    const addr = addresses.find((a) => a.id === addressId);
    if (!addr) return;
    form.setFieldsValue({
      consignee: addr.consignee,
      consigneePhone: addr.phone,
      consigneeAddress: addr.detailAddress,
      region: [addr.province, addr.city, addr.district].filter(Boolean),
      addressId: addr.id,
    });
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

  // ============ AI 功能 ============

  const handleApplyAiDraft = async (draft: OrderDraft) => {
    // 设置基础字段
    form.setFieldsValue({
      type: draft.type,
      customerId: draft.customerId,
      remark: draft.remark,
      deliveryDate: draft.deliveryDate ? dayjs(draft.deliveryDate) : null,
    });

    // 触发客户变化加载地址
    await handleCustomerChange(draft.customerId);

    // 并行加载所有 SKU 列表
    const skuPromises = draft.items.map(async (item, index) => {
      try {
        const skus = await fetchSkus(item.productId);
        return { index, skus };
      } catch {
        return { index, skus: [] };
      }
    });

    const skuResults = await Promise.all(skuPromises);
    const newSkuMap: Record<string, any[]> = {};
    skuResults.forEach((r) => {
      newSkuMap[r.index] = r.skus;
    });
    setSkuMap(newSkuMap);

    // 设置商品明细
    const formItems = draft.items.map((item) => ({
      productId: item.productId,
      skuId: item.skuId,
      qty: item.qty,
      unitPrice: item.unitPrice,
      discountAmount: 0,
      lineAmount: item.lineAmount,
    }));

    form.setFieldValue('items', formItems);
    form.setFieldsValue({
      totalAmount: draft.totalAmount,
      payAmount: draft.payAmount,
    });

    message.success('AI 订单已填充到表单，请检查确认');
  };

  const handleAddRecommendationItem = async (item: {
    productId: string;
    skuId: string;
    skuCode: string;
    skuName: string;
    qty: number;
    unitPrice: number;
  }) => {
    const currentItems = form.getFieldValue('items') || [];
    const index = currentItems.length;

    try {
      const skus = await fetchSkus(item.productId);
      setSkuMap((prev) => ({ ...prev, [index]: skus }));
    } catch {
      setSkuMap((prev) => ({ ...prev, [index]: [] }));
    }

    const newItem = {
      productId: item.productId,
      skuId: item.skuId,
      qty: item.qty,
      unitPrice: item.unitPrice,
      discountAmount: 0,
      lineAmount: item.qty * item.unitPrice,
    };

    form.setFieldValue('items', [...currentItems, newItem]);
    recalcTotal();
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
          skuCode: sku?.skuCode || '',
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
        salespersonId: values.salespersonId,
        totalAmount: values.totalAmount,
        payAmount: values.payAmount,
        items,
        remark: values.remark,
        deliveryDate: values.deliveryDate ? values.deliveryDate.format('YYYY-MM-DD') : undefined,
        invoiceDate: values.invoiceDate ? values.invoiceDate.format('YYYY-MM-DD') : undefined,
        paymentDueDate: values.paymentDueDate ? values.paymentDueDate.format('YYYY-MM-DD') : undefined,
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

  // 合并商品列表与订单中已存在但可能不在列表里的商品（如被删除或分页未加载）
  const productOptionMap = new Map<string, string>();
  products.forEach((p) => productOptionMap.set(p.id, p.name));
  editingOrder?.items?.forEach((item: any) => {
    if (item.productId && !productOptionMap.has(item.productId)) {
      productOptionMap.set(item.productId, item.productName || '未知商品');
    }
  });
  const productOptions = Array.from(productOptionMap.entries()).map(
    ([value, label]) => ({ label, value }),
  );

  const tableHeaderStyle: React.CSSProperties = {
    display: 'flex',
    fontWeight: 500,
    fontSize: 13,
    color: '#A0A0A0',
    padding: '8px 4px',
    borderBottom: '1px solid #F0E6FF',
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
        <AiOrderInput onApply={handleApplyAiDraft} />

        <Form.Item
          label="订单类型"
          name="type"
          initialValue="sales"
          rules={[{ required: true, message: '请选择订单类型' }]}
        >
          <Select placeholder="请选择订单类型" options={orderTypeOptions} />
        </Form.Item>

        <Form.Item
          label="业务员"
          name="salespersonId"
          rules={[{ required: true, message: '请选择业务员' }]}
        >
          <Select
            placeholder="请选择业务员"
            showSearch
            filterOption={filterOption}
            style={{ width: '100%' }}
            virtual={false}
            listHeight={500}
            dropdownStyle={{ minWidth: 200 }}
            optionLabelProp="label"
            options={[
              ...users.map((u) => ({
                label: u.name,
                value: u.id,
                title: u.name,
              })),
              ...(editingOrder?.salespersonId &&
              !users.some((u) => u.id === editingOrder.salespersonId)
                ? [
                    {
                      label: editingOrder.salesperson?.name || '已删除用户',
                      value: editingOrder.salespersonId,
                      title: editingOrder.salesperson?.name || '已删除用户',
                    },
                  ]
                : []),
            ]}
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
            style={{ width: '100%' }}
            virtual={false}
            listHeight={500}
            dropdownStyle={{ minWidth: 300, maxWidth: 500 }}
            optionLabelProp="label"
            options={customers.map((c) => ({
              label: c.name,
              value: c.id,
              title: c.name,
            }))}
            onChange={handleCustomerChange}
          />
        </Form.Item>

        {customerId && (
          <CustomerRecommendationPanel
            customerId={customerId}
            onAddItem={handleAddRecommendationItem}
          />
        )}

        {addresses.length > 0 && (
          <Form.Item label="选择地址" name="addressId">
            <Select
              placeholder="请选择地址（自动填充收货信息）"
              allowClear
              options={addresses.map((a) => ({
                label: (
                  <span>
                    {a.consignee} {a.phone && `(${a.phone})`}{' '}
                    {[a.province, a.city, a.district, a.detailAddress]
                      .filter(Boolean)
                      .join(' ')}
                    {a.isDefault && (
                      <span style={{ color: '#2563EB', marginLeft: 8 }}>
                        [默认]
                      </span>
                    )}
                  </span>
                ),
                value: a.id,
              }))}
              onChange={handleAddressChange}
            />
          </Form.Item>
        )}

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
                            options={(() => {
                              const currentSkus = skuMap[name] || [];
                              const orderItem = editingOrder?.items?.[name];
                              const opts = currentSkus.map((s: any) => ({
                                label: s.skuName || s.skuCode || s.jstSkuId,
                                value: s.id,
                              }));
                              if (
                                orderItem?.skuId &&
                                !currentSkus.some(
                                  (s: any) => s.id === orderItem.skuId,
                                )
                              ) {
                                opts.push({
                                  label:
                                    orderItem.skuName ||
                                    orderItem.skuCode ||
                                    '未知规格',
                                  value: orderItem.skuId,
                                });
                              }
                              return opts;
                            })()}
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
                              background: '#FFF8E7',
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
            background: '#E8F5E9',
            padding: 16,
            borderRadius: 10,
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
              style={{ width: 140, background: '#FFF8E7' }}
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
              style={{ width: 140, background: '#FFF8E7' }}
              precision={2}
              prefix="¥"
            />
          </Form.Item>
        </div>

        <Form.Item label="预计交货日期" name="deliveryDate">
          <DatePicker
            placeholder="请选择预计交货日期"
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
          />
        </Form.Item>

        <Form.Item label="开票日期" name="invoiceDate">
          <DatePicker
            placeholder="请选择开票日期"
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
          />
        </Form.Item>

        <Form.Item label="付款截止日期" name="paymentDueDate">
          <DatePicker
            placeholder="请选择付款截止日期"
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
          />
        </Form.Item>

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
