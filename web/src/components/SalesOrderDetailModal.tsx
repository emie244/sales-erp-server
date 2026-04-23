import { useState } from 'react';
import {
  Modal,
  Descriptions,
  Table,
  Spin,
  Empty,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Space,
  Divider,
  Card,
  Steps,
} from 'antd';
import StatusTag from './StatusTag';
import { createCollection, pushJushuitan } from '@/api/sales';
import { hasPermission } from '@/utils/permissions';
import type { SalesOrder } from '@/types';

interface Props {
  open: boolean;
  order: SalesOrder | null;
  loading: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onEditOrder?: (order: SalesOrder) => void;
  onEditCollection?: (order: SalesOrder) => void;
  onRefreshOrder?: (orderId: string) => Promise<SalesOrder>;
}

export default function SalesOrderDetailModal({
  open,
  order,
  loading,
  onClose,
  onSuccess,
  onEditOrder,
  onEditCollection,
  onRefreshOrder,
}: Props) {
  const [collectionForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{
    success: boolean;
    jushuitanOrderId?: number;
    error?: string;
  } | null>(null);

  const itemColumns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      key: 'productName',
      render: (v: string) => v || '-',
    },
    {
      title: '规格型号',
      dataIndex: 'skuName',
      key: 'skuName',
    },
    {
      title: '数量',
      dataIndex: 'qty',
      key: 'qty',
      align: 'right' as const,
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      align: 'right' as const,
      render: (v: number) => `¥${parseFloat(v?.toString() || '0').toFixed(2)}`,
    },
    {
      title: '折扣',
      dataIndex: 'discountAmount',
      key: 'discountAmount',
      align: 'right' as const,
      render: (v: number) =>
        v ? `¥${parseFloat(v?.toString() || '0').toFixed(2)}` : '-',
    },
    {
      title: '小计',
      dataIndex: 'lineAmount',
      key: 'lineAmount',
      align: 'right' as const,
      render: (v: number) => `¥${parseFloat(v?.toString() || '0').toFixed(2)}`,
    },
  ];

  const handleCollection = async (values: any) => {
    if (!order) return;
    setSubmitting(true);
    try {
      await createCollection(order.id, {
        amount: values.amount || 0,
        prepaymentDeducted: values.prepaymentDeducted || 0,
        method: values.method,
        remark: values.remark,
      });
      message.success('回款审批提交成功');
      setShowCollectionForm(false);
      collectionForm.resetFields();
      // 刷新订单详情，更新状态和按钮显示
      if (onRefreshOrder) {
        try {
          await onRefreshOrder(order.id);
        } catch {
          // 刷新失败不影响主流程
        }
      }
      onSuccess?.();
    } catch (err: any) {
      message.error(err?.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const remainingAmount = order
    ? (order.payAmount || 0) -
      (order.collectedAmount || 0) -
      (order.prepaymentDeducted || 0)
    : 0;

  // 推送聚水潭
  const handlePushJushuitan = async () => {
    if (!order) return;
    setPushing(true);
    setPushResult(null);
    try {
      const res = await pushJushuitan(order.id);
      if (res.success) {
        message.success(
          res.jushuitanOrderId
            ? `推送成功，聚水潭订单号：${res.jushuitanOrderId}`
            : '推送成功',
        );
        // 刷新订单详情，更新 Steps 和按钮状态
        if (onRefreshOrder) {
          try {
            await onRefreshOrder(order.id);
          } catch {
            // 刷新失败不影响主流程
          }
        }
        onSuccess?.();
      } else {
        setPushResult({
          success: false,
          error: res.error || res.response?.msg || '推送失败',
        });
        message.error(res.error || res.response?.msg || '推送失败');
      }
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.message || err.message || '推送失败';
      setPushResult({
        success: false,
        error: errorMsg,
      });
      message.error(errorMsg);
    } finally {
      setPushing(false);
    }
  };

  // 判断是否可以回款（已批准且还有未收款项）
  const canCollect =
    order &&
    ['approved', 'synced_jst', 'shipped'].includes(order.status) &&
    remainingAmount > 0.01;

  // 判断是否已驳回（可以编辑）
  const isRejected = order?.status === 'rejected';

  // 判断是否是回款驳回（有collectionData）
  const isCollectionRejected = isRejected && order?.collectionData;

  // 判断是否是订单驳回（没有collectionData）
  const isOrderRejected = isRejected && !order?.collectionData;

  const orderTypeMap: Record<string, string> = {
    sales: '销售订单',
    overseas: '海外提货单',
  };

  // 生成订单进度步骤
  const getOrderSteps = () => {
    if (!order) return [];

    const steps = [];
    const approvalRecord = order.approvalRecords?.[0];
    const deliveryOrder = order.deliveryOrders?.[0];

    // 步骤1: 创建订单
    steps.push({
      title: '创建订单',
      description: order.createdAt
        ? new Date(order.createdAt).toLocaleString('zh-CN')
        : '-',
      status: 'finish' as const,
    });

    // 步骤2: 提交审批
    if (approvalRecord) {
      steps.push({
        title: '提交审批',
        description: new Date(approvalRecord.createdAt).toLocaleString('zh-CN'),
        status: 'finish' as const,
      });

      // 步骤3: 审批结果
      if (approvalRecord.status === 'approved') {
        steps.push({
          title: '审批通过',
          description: approvalRecord.updatedAt
            ? new Date(approvalRecord.updatedAt).toLocaleString('zh-CN')
            : '-',
          status: 'finish' as const,
        });
      } else if (approvalRecord.status === 'rejected') {
        steps.push({
          title: '审批驳回',
          description: approvalRecord.updatedAt
            ? new Date(approvalRecord.updatedAt).toLocaleString('zh-CN')
            : '-',
          status: 'error' as const,
        });
      } else {
        steps.push({
          title: '审批中',
          description: '等待审批结果',
          status: 'process' as const,
        });
      }
    } else if (order.status === 'draft') {
      steps.push({
        title: '提交审批',
        description: '待提交',
        status: 'wait' as const,
      });
    }

    // 步骤4: 推送聚水潭
    if (
      order.status === 'synced_jst' ||
      order.status === 'shipped' ||
      order.status === 'completed'
    ) {
      steps.push({
        title: '推送聚水潭',
        description: order.updatedAt
          ? new Date(order.updatedAt).toLocaleString('zh-CN')
          : '-',
        status: 'finish' as const,
      });
    } else if (
      approvalRecord?.status === 'approved' &&
      order.status !== 'rejected'
    ) {
      steps.push({
        title: '推送聚水潭',
        description: '待推送',
        status: 'wait' as const,
      });
    }

    // 步骤5: 发货
    if (
      deliveryOrder ||
      order.status === 'shipped' ||
      order.status === 'completed'
    ) {
      steps.push({
        title: '已发货',
        description: deliveryOrder?.shippedAt
          ? new Date(deliveryOrder.shippedAt).toLocaleString('zh-CN')
          : '-',
        status: 'finish' as const,
      });
    } else if (order.status === 'synced_jst') {
      steps.push({
        title: '发货',
        description: '待发货',
        status: 'wait' as const,
      });
    }

    // 步骤6: 完成
    if (order.status === 'completed') {
      steps.push({
        title: '已完成',
        description: order.updatedAt
          ? new Date(order.updatedAt).toLocaleString('zh-CN')
          : '-',
        status: 'finish' as const,
      });
    } else if (order.status === 'shipped') {
      steps.push({
        title: '完成',
        description: '待回款完成',
        status: 'wait' as const,
      });
    }

    return steps;
  };

  const orderSteps = getOrderSteps();
  const currentStep = orderSteps.findIndex((s) => s.status === 'process');

  return (
    <Modal
      title="订单详情"
      open={open}
      onCancel={onClose}
      footer={null}
      width={900}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
        </div>
      ) : !order ? (
        <Empty description="未找到订单信息" />
      ) : (
        <div style={{ marginTop: 16 }}>
          {/* 订单进度 */}
          {orderSteps.length > 0 && (
            <div
              style={{
                marginBottom: 24,
                padding: '16px',
                background: '#fafafa',
                borderRadius: 8,
              }}
            >
              <h4 style={{ marginBottom: 16, fontWeight: 600 }}>订单进度</h4>
              <Steps
                current={currentStep >= 0 ? currentStep : orderSteps.length}
                size="small"
                direction="horizontal"
                items={orderSteps}
              />
            </div>
          )}

          {/* 操作按钮区域 */}
          {isOrderRejected && hasPermission('order:edit') && (
            <div style={{ marginBottom: 16, textAlign: 'right' }}>
              <Button type="primary" onClick={() => onEditOrder?.(order)}>
                编辑订单并重新提交
              </Button>
            </div>
          )}
          {isCollectionRejected && hasPermission('order:collect') && (
            <div style={{ marginBottom: 16, textAlign: 'right' }}>
              <Button type="primary" onClick={() => onEditCollection?.(order)}>
                编辑回款并重新提交
              </Button>
            </div>
          )}
          {order.status === 'approved' && hasPermission('order:push_jst') && (
            <div style={{ marginBottom: 16, textAlign: 'right' }}>
              <Button
                type="primary"
                loading={pushing}
                disabled={pushing}
                onClick={handlePushJushuitan}
              >
                推送聚水潭
              </Button>
            </div>
          )}
          {pushResult && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 4,
                background: pushResult.success ? '#f6ffed' : '#fff2f0',
                border: `1px solid ${pushResult.success ? '#b7eb8f' : '#ffccc7'}`,
              }}
            >
              {pushResult.success ? (
                <div>
                  <div style={{ color: '#52c41a', fontWeight: 500 }}>
                    推送成功
                  </div>
                  {pushResult.jushuitanOrderId && (
                    <div style={{ color: '#666', marginTop: 4 }}>
                      聚水潭订单号：{pushResult.jushuitanOrderId}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ color: '#ff4d4f', fontWeight: 500 }}>
                    推送失败
                  </div>
                  <div style={{ color: '#666', marginTop: 4 }}>
                    {pushResult.error}
                  </div>
                </div>
              )}
            </div>
          )}

          <Descriptions title="基本信息" bordered size="small" column={2}>
            <Descriptions.Item label="订单号">{order.id}</Descriptions.Item>
            <Descriptions.Item label="订单类型">
              {orderTypeMap[order.type || ''] || order.type || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <StatusTag
                status={order.status}
                collectedAmount={order.collectedAmount}
                payAmount={order.payAmount}
                prepaymentDeducted={order.prepaymentDeducted}
              />
            </Descriptions.Item>
            <Descriptions.Item label="客户">
              {order.customer?.name || order.customerName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="签单人">
              {order.signer?.name || order.signerName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="聚水潭店铺ID">
              {order.signer?.jushuitanShopId ? (
                <span style={{ color: '#52c41a' }}>
                  {order.signer.jushuitanShopId}
                </span>
              ) : (
                <span style={{ color: '#ff4d4f' }}>未配置</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="创建人">
              {order.creator?.name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {order.createdAt?.replace('T', ' ').slice(0, 19)}
            </Descriptions.Item>
            <Descriptions.Item label="订单金额">
              ¥{parseFloat(order.totalAmount?.toString() || '0').toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="应付金额">
              ¥{parseFloat(order.payAmount?.toString() || '0').toFixed(2)}
            </Descriptions.Item>
            {order.paymentMethod && (
              <Descriptions.Item label="收款方式">
                {order.paymentMethod}
              </Descriptions.Item>
            )}
            {order.logisticsCompany && (
              <Descriptions.Item label="快递公司">
                {order.logisticsCompany}
              </Descriptions.Item>
            )}
            {order.expressNo && (
              <Descriptions.Item label="快递单号">
                {order.expressNo}
              </Descriptions.Item>
            )}
            {order.buyerMessage && (
              <Descriptions.Item label="买家留言" span={2}>
                {order.buyerMessage}
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* 收款信息 */}
          {((order.collectedAmount || 0) > 0 ||
            (order.prepaymentDeducted || 0) > 0) && (
            <div style={{ marginTop: 24 }}>
              <h4 style={{ marginBottom: 12, fontWeight: 600 }}>收款信息</h4>
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="已回款">
                  ¥
                  {parseFloat((order.collectedAmount || 0).toString()).toFixed(
                    2,
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="预付款抵扣">
                  ¥
                  {parseFloat(
                    (order.prepaymentDeducted || 0).toString(),
                  ).toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="剩余应收">
                  ¥{remainingAmount.toFixed(2)}
                </Descriptions.Item>
              </Descriptions>
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <h4 style={{ marginBottom: 12, fontWeight: 600 }}>订单明细</h4>
            <Table
              rowKey="id"
              columns={itemColumns}
              dataSource={order.items || []}
              pagination={false}
              size="small"
              bordered
            />
          </div>

          {/* 回款操作 */}
          {canCollect && hasPermission('order:collect') && (
            <div style={{ marginTop: 24 }}>
              <Divider />
              <Card
                title="回款登记（需审批）"
                extra={
                  <Button
                    type="primary"
                    onClick={() => setShowCollectionForm(!showCollectionForm)}
                  >
                    {showCollectionForm ? '取消' : '登记回款'}
                  </Button>
                }
              >
                {showCollectionForm && (
                  <Form
                    form={collectionForm}
                    layout="vertical"
                    onFinish={handleCollection}
                  >
                    <Space align="start" style={{ width: '100%' }}>
                      <Form.Item
                        name="amount"
                        label={`实际回款 (剩余应收: ¥${remainingAmount.toFixed(2)})`}
                        rules={[{ required: true, message: '请输入回款金额' }]}
                        style={{ width: 200 }}
                      >
                        <InputNumber
                          min={0}
                          max={remainingAmount}
                          precision={2}
                          prefix="¥"
                          style={{ width: '100%' }}
                          placeholder="实际回款金额"
                        />
                      </Form.Item>
                      <Form.Item
                        name="prepaymentDeducted"
                        label="预付款抵扣"
                        style={{ width: 200 }}
                      >
                        <InputNumber
                          min={0}
                          max={Math.min(
                            remainingAmount,
                            order.customer?.prepaymentBalance || 0,
                          )}
                          precision={2}
                          prefix="¥"
                          style={{ width: '100%' }}
                          placeholder="预付款抵扣金额"
                        />
                      </Form.Item>
                      <Form.Item
                        name="method"
                        label="回款方式"
                        rules={[{ required: true, message: '请选择方式' }]}
                        style={{ width: 200 }}
                      >
                        <Select placeholder="回款方式">
                          <Select.Option value="bank_transfer">
                            银行转账
                          </Select.Option>
                          <Select.Option value="alipay">支付宝</Select.Option>
                          <Select.Option value="wechat">微信支付</Select.Option>
                          <Select.Option value="cash">现金</Select.Option>
                          <Select.Option value="prepayment">
                            预付款抵扣
                          </Select.Option>
                        </Select>
                      </Form.Item>
                    </Space>
                    <Form.Item name="remark" label="备注">
                      <Input.TextArea
                        rows={2}
                        style={{ width: '100%' }}
                        placeholder="备注"
                      />
                    </Form.Item>
                    <Form.Item>
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={submitting}
                      >
                        提交回款审批
                      </Button>
                    </Form.Item>
                  </Form>
                )}
              </Card>
            </div>
          )}

          {(order.consignee ||
            order.consigneePhone ||
            order.consigneeTel ||
            order.consigneeAddress ||
            order.consigneeProvince) && (
            <div style={{ marginTop: 24 }}>
              <h4 style={{ marginBottom: 12, fontWeight: 600 }}>收货信息</h4>
              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="收货人">
                  {order.consignee || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="联系电话">
                  {order.consigneePhone || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="座机电话">
                  {order.consigneeTel || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="收货地址" span={2}>
                  {[
                    order.consigneeProvince,
                    order.consigneeCity,
                    order.consigneeDistrict,
                    order.consigneeTown,
                    order.consigneeAddress,
                  ]
                    .filter(Boolean)
                    .join(' ') || '-'}
                </Descriptions.Item>
              </Descriptions>
            </div>
          )}

          {order.remark && (
            <div style={{ marginTop: 24 }}>
              <h4 style={{ marginBottom: 12, fontWeight: 600 }}>备注</h4>
              <div
                style={{
                  padding: 12,
                  background: '#f5f5f5',
                  borderRadius: 4,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {order.remark}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
