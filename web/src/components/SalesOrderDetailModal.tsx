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
  Upload,
  Row,
  Col,
} from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import StatusTag from './StatusTag';
import { createCollection, pushJushuitan } from '@/api/sales';
import { hasPermission } from '@/utils/permissions';
import { formatDateTime } from '@/utils/datetime';
import { FEISHU_COLLECTION_APPROVAL_DEF_CODE } from '@/config';
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

const normFile = (e: any) => {
  if (Array.isArray(e)) return e;
  return e?.fileList;
};

const extractAttachmentUrls = (fileList: any[]): string[] => {
  if (!Array.isArray(fileList)) return [];
  return fileList
    .filter((f) => f.status === 'done')
    .map((f) => f.response?.data?.url || f.response?.url)
    .filter(Boolean);
};

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

  const paymentColumns = [
    {
      title: '回款时间',
      dataIndex: 'receivedAt',
      key: 'receivedAt',
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '修改时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '回款方式',
      dataIndex: 'method',
      key: 'method',
      render: (v: string) => {
        const map: Record<string, string> = {
          bank_transfer: '银行转账',
          alipay: '支付宝',
          wechat: '微信支付',
          cash: '现金',
          prepayment: '预付款抵扣',
          'Jean-支付宝': 'Jean-支付宝',
          '宝生银行-亿觅': '宝生银行-亿觅',
          '支付宝-Sue': '支付宝-Sue',
          '招商银行-亿觅(云城支行)': '招商银行-亿觅(云城支行)',
          预收款项: '预收款项',
          '谭钦成-招行': '谭钦成-招行',
          '支付宝-亿觅acc': '支付宝-亿觅acc',
          额度帐扣: '额度帐扣',
          '兴业银行-亿觅': '兴业银行-亿觅',
        };
        return map[v] || v || '-';
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (v: number) => `¥${parseFloat((v || 0).toString()).toFixed(2)}`,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (v: string) => v || '-',
    },
    {
      title: '凭证',
      dataIndex: 'attachments',
      key: 'attachments',
      render: (attachments: string[]) => {
        if (!attachments?.length) return '-';
        return (
          <Space direction="vertical" size="small">
            {attachments.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                凭证{i + 1}
              </a>
            ))}
          </Space>
        );
      },
    },
  ];

  const handleClose = () => {
    setShowCollectionForm(false);
    collectionForm.resetFields();
    onClose();
  };

  const handleCollection = async (values: any) => {
    if (!order) return;

    const feishuUserId = localStorage.getItem('erp_feishu_user_id');
    const feishuUserIdType =
      localStorage.getItem('erp_feishu_user_id_type') || 'user_id';
    if (!feishuUserId || feishuUserIdType !== 'user_id') {
      message.error(
        '当前账号未绑定飞书 User ID，请联系管理员在「系统管理-用户管理」中补充飞书 User ID（员工编号）',
      );
      return;
    }

    const records = (values.records || []).map((rec: any) => ({
      amount: rec.amount || 0,
      method: rec.method,
      remark: rec.remark || '',
      attachments: extractAttachmentUrls(rec.attachments),
    }));

    if (!records.length) {
      message.error('请至少添加一条回款记录');
      return;
    }

    for (let i = 0; i < records.length; i++) {
      if (!records[i].attachments || records[i].attachments.length === 0) {
        message.error(`第 ${i + 1} 条回款记录未上传凭证，请上传回款凭证`);
        return;
      }
    }

    const total = records.reduce(
      (sum: number, r: any) => sum + (r.amount || 0),
      0,
    );
    if (total > remainingAmount + 0.01) {
      Modal.error({
        title: '回款金额超限',
        content: `回款总额 ¥${total.toFixed(2)} 超过剩余应收 ¥${remainingAmount.toFixed(2)}，请调整回款金额后重新提交。`,
      });
      return;
    }

    setSubmitting(true);
    try {
      await createCollection(order.id, {
        records,
        feishuUserId,
        feishuUserIdType,
        approvalDefCode: FEISHU_COLLECTION_APPROVAL_DEF_CODE,
      });
      message.success('回款审批提交成功');
      setShowCollectionForm(false);
      collectionForm.resetFields();
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

  const collectionRecord = order?.approvalRecords?.find(
    (r) => r.type === 'collection',
  );

  // 判断是否是回款驳回
  const isCollectionRejected = collectionRecord?.status === 'rejected';

  // 判断是否可以编辑订单（草稿、已驳回、已批准）
  const canEditOrder = ['draft', 'rejected', 'approved'].includes(
    order?.status || '',
  );

  const orderTypeMap: Record<string, string> = {
    sales: '销售订单',
    overseas: '海外提货单',
  };

  // 生成订单进度步骤
  const getOrderSteps = () => {
    if (!order) return [];

    const steps = [];
    const approvalRecord = order.approvalRecords?.find(
      (r) => r.type === 'sales_order',
    );
    const collectionRecord = order.approvalRecords?.find(
      (r) => r.type === 'collection',
    );
    const deliveryOrder = order.deliveryOrders?.[0];

    // 步骤1: 创建订单
    steps.push({
      title: '创建订单',
      description: formatDateTime(order.createdAt),
      status: 'finish' as const,
    });

    // 步骤2: 提交审批
    if (approvalRecord) {
      steps.push({
        title: '提交审批',
        description: formatDateTime(approvalRecord.createdAt),
        status: 'finish' as const,
      });

      // 步骤3: 审批结果
      if (approvalRecord.status === 'approved') {
        steps.push({
          title: '审批通过',
          description: formatDateTime(approvalRecord.updatedAt),
          status: 'finish' as const,
        });
      } else if (approvalRecord.status === 'rejected') {
        steps.push({
          title: '审批驳回',
          description: formatDateTime(approvalRecord.updatedAt),
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
        description: formatDateTime(order.updatedAt),
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
        description: formatDateTime(deliveryOrder?.shippedAt),
        status: 'finish' as const,
      });
    } else if (order.status === 'synced_jst') {
      steps.push({
        title: '发货',
        description: '待发货',
        status: 'wait' as const,
      });
    }

    // 步骤6: 回款审批
    if (collectionRecord) {
      if (collectionRecord.status === 'approved') {
        steps.push({
          title: '回款审批通过',
          description: formatDateTime(collectionRecord.updatedAt),
          status: 'finish' as const,
        });
      } else if (collectionRecord.status === 'rejected') {
        steps.push({
          title: '回款审批驳回',
          description: formatDateTime(collectionRecord.updatedAt),
          status: 'error' as const,
        });
      } else {
        steps.push({
          title: '回款审批中',
          description: '等待审批结果',
          status: 'process' as const,
        });
      }
    }

    // 步骤7: 完成
    if (order.status === 'completed') {
      steps.push({
        title: '已完成',
        description: formatDateTime(order.updatedAt),
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

  const methodOptions = [
    { value: 'Jean-支付宝', label: 'Jean-支付宝' },
    { value: '宝生银行-亿觅', label: '宝生银行-亿觅' },
    { value: '支付宝-Sue', label: '支付宝-Sue' },
    { value: '招商银行-亿觅(云城支行)', label: '招商银行-亿觅(云城支行)' },
    { value: '预收款项', label: '预收款项' },
    { value: '谭钦成-招行', label: '谭钦成-招行' },
    { value: '支付宝-亿觅acc', label: '支付宝-亿觅acc' },
    { value: '额度帐扣', label: '额度帐扣' },
    { value: '兴业银行-亿觅', label: '兴业银行-亿觅' },
    { value: 'bank_transfer', label: '银行转账' },
    { value: 'alipay', label: '支付宝' },
    { value: 'wechat', label: '微信支付' },
    { value: 'cash', label: '现金' },
    { value: 'prepayment', label: '预付款抵扣' },
  ];

  return (
    <Modal
      title="订单详情"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={960}
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
                background: '#FFF8E7',
                borderRadius: 12,
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
          {canEditOrder && hasPermission('order:edit') && (
            <div style={{ marginBottom: 16, textAlign: 'right' }}>
              <Button type="primary" onClick={() => onEditOrder?.(order)}>
                {order?.status === 'approved'
                  ? '编辑订单（修改后需重新审批）'
                  : '编辑订单并重新提交'}
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
                borderRadius: 10,
                background: pushResult.success ? '#E8F5E9' : '#FFEBEE',
                border: `1px solid ${pushResult.success ? '#A8E6CF' : '#2563EB'}`,
              }}
            >
              {pushResult.success ? (
                <div>
                  <div style={{ color: '#A8E6CF', fontWeight: 500 }}>
                    推送成功
                  </div>
                  {pushResult.jushuitanOrderId && (
                    <div style={{ color: '#A0A0A0', marginTop: 4 }}>
                      聚水潭订单号：{pushResult.jushuitanOrderId}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ color: '#E83E3E', fontWeight: 500 }}>
                    推送失败
                  </div>
                  <div style={{ color: '#A0A0A0', marginTop: 4 }}>
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
            <Descriptions.Item label="业务员">
              {order.salesperson?.name || order.salespersonName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="聚水潭店铺ID">
              {order.salesperson?.jushuitanShopId ? (
                <span style={{ color: '#A8E6CF' }}>
                  {order.salesperson.jushuitanShopId}
                </span>
              ) : (
                <span style={{ color: '#E83E3E' }}>未配置</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="创建人">
              {order.creator?.name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {formatDateTime(order.createdAt)}
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

          {/* 历史回款记录 */}
          {order.paymentRecords && order.paymentRecords.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h4 style={{ marginBottom: 12, fontWeight: 600 }}>回款记录</h4>
              <Table
                rowKey="id"
                columns={paymentColumns}
                dataSource={order.paymentRecords}
                pagination={false}
                size="small"
                bordered
              />
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
                    onClick={() => {
                      if (showCollectionForm) {
                        collectionForm.resetFields();
                      } else {
                        collectionForm.setFieldsValue({ records: [{}] });
                      }
                      setShowCollectionForm(!showCollectionForm);
                    }}
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
                    <Form.List
                      name="records"
                      rules={[
                        {
                          validator: async (_, records) => {
                            if (!records || records.length === 0) {
                              return Promise.reject(
                                new Error('请至少添加一条回款记录'),
                              );
                            }
                            const total = records.reduce(
                              (sum: number, r: any) => sum + (r?.amount || 0),
                              0,
                            );
                            if (total > remainingAmount + 0.01) {
                              return Promise.reject(
                                new Error(
                                  `回款总额 ¥${total.toFixed(2)} 超过剩余应收 ¥${remainingAmount.toFixed(2)}`,
                                ),
                              );
                            }
                          },
                        },
                      ]}
                    >
                      {(fields, { add, remove }) => (
                        <div>
                          {fields.map((field) => (
                            <Row
                              key={field.key}
                              gutter={16}
                              align="middle"
                              style={{
                                marginBottom: 16,
                                padding: 12,
                                background: '#FFF8E7',
                                borderRadius: 10,
                              }}
                            >
                              <Col span={6}>
                                <Form.Item
                                  name={[field.name, 'amount']}
                                  label="回款金额"
                                  rules={[
                                    {
                                      required: true,
                                      message: '请输入回款金额',
                                    },
                                  ]}
                                  style={{ marginBottom: 0 }}
                                >
                                  <InputNumber
                                    min={0}
                                    max={remainingAmount}
                                    precision={2}
                                    prefix="¥"
                                    style={{ width: '100%' }}
                                    placeholder="回款金额"
                                  />
                                </Form.Item>
                              </Col>
                              <Col span={5}>
                                <Form.Item
                                  name={[field.name, 'method']}
                                  label="回款方式"
                                  rules={[
                                    {
                                      required: true,
                                      message: '请选择回款方式',
                                    },
                                  ]}
                                  style={{ marginBottom: 0 }}
                                >
                                  <Select placeholder="回款方式">
                                    {methodOptions.map((opt) => (
                                      <Select.Option
                                        key={opt.value}
                                        value={opt.value}
                                      >
                                        {opt.label}
                                      </Select.Option>
                                    ))}
                                  </Select>
                                </Form.Item>
                              </Col>
                              <Col span={9}>
                                <Form.Item
                                  name={[field.name, 'remark']}
                                  label="备注"
                                  style={{ marginBottom: 0 }}
                                >
                                  <Input placeholder="备注" />
                                </Form.Item>
                              </Col>
                              <Col span={3}>
                                <Form.Item
                                  name={[field.name, 'attachments']}
                                  label="凭证"
                                  valuePropName="fileList"
                                  getValueFromEvent={normFile}
                                  rules={[
                                    {
                                      required: true,
                                      message: '请上传回款凭证',
                                    },
                                  ]}
                                  style={{ marginBottom: 0 }}
                                >
                                  <Upload
                                    action="/api/v1/uploads"
                                    headers={{
                                      Authorization: `Bearer ${localStorage.getItem('erp_token') || ''}`,
                                    }}
                                    listType="picture"
                                    maxCount={3}
                                  >
                                    <Button size="small">上传</Button>
                                  </Upload>
                                </Form.Item>
                              </Col>
                              <Col
                                span={1}
                                style={{
                                  textAlign: 'center',
                                  paddingTop: 24,
                                }}
                              >
                                {fields.length > 1 && (
                                  <MinusCircleOutlined
                                    style={{ color: '#E83E3E' }}
                                    onClick={() => remove(field.name)}
                                  />
                                )}
                              </Col>
                            </Row>
                          ))}
                          <Button
                            type="dashed"
                            onClick={() => add()}
                            icon={<PlusOutlined />}
                            style={{ width: '100%' }}
                          >
                            添加回款记录
                          </Button>
                        </div>
                      )}
                    </Form.List>

                    <div
                      style={{
                        marginTop: 12,
                        color: '#A0A0A0',
                        fontSize: 13,
                      }}
                    >
                      剩余应收：¥{remainingAmount.toFixed(2)}
                    </div>

                    <Form.Item style={{ marginTop: 16, marginBottom: 0 }}>
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
                  background: '#FFF8E7',
                  borderRadius: 10,
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
