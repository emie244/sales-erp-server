import { useState } from 'react';
import { Input, Button, Card, Spin, Space, Tag, Alert, Typography } from 'antd';
import { ThunderboltOutlined, CheckOutlined, CloseOutlined, RobotOutlined } from '@ant-design/icons';
import { parseOrderByAI, type OrderDraft } from '@/api/ai';

const { Text } = Typography;

interface Props {
  onApply: (draft: OrderDraft) => void;
}

export default function AiOrderInput({ onApply }: Props) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    draft: OrderDraft | null;
    warnings: string[];
    missingFields: string[];
    confidence: 'high' | 'medium' | 'low';
  } | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await parseOrderByAI(text.trim());
      setResult(res);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || '解析失败';
      setResult({ draft: null, warnings: [msg], missingFields: [], confidence: 'low' });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (result?.draft) {
      onApply(result.draft);
      setResult(null);
      setText('');
      setExpanded(false);
    }
  };

  const handleDiscard = () => {
    setResult(null);
  };

  const confidenceColor = {
    high: 'success',
    medium: 'warning',
    low: 'error',
  } as const;

  const confidenceLabel = {
    high: '高',
    medium: '中',
    low: '低',
  };

  if (!expanded) {
    return (
      <div style={{ marginBottom: 16 }}>
        <Button
          type="dashed"
          icon={<RobotOutlined />}
          block
          onClick={() => setExpanded(true)}
        >
          🤖 AI 智能下单 — 用自然语言描述订单
        </Button>
      </div>
    );
  }

  return (
    <Card
      size="small"
      style={{ marginBottom: 16, background: '#f6ffed', borderColor: '#b7eb8f' }}
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#52c41a' }} />
          <span>AI 智能下单</span>
        </Space>
      }
      extra={
        <Button type="link" size="small" onClick={() => setExpanded(false)}>
          收起
        </Button>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Input.TextArea
          placeholder="例如：给深圳市XX科技下500个EM-T10充电宝，单价45元，6月15日交货"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={500}
          showCount
        />
        <Button
          type="primary"
          icon={<RobotOutlined />}
          onClick={handleParse}
          loading={loading}
          disabled={!text.trim()}
          block
        >
          {loading ? 'AI 解析中...' : '解析订单'}
        </Button>

        {loading && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin tip="AI 正在解析您的订单描述..." />
          </div>
        )}

        {result && !loading && (
          <div>
            {result.warnings.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                }
              />
            )}

            {result.draft && (
              <>
                <div style={{ marginBottom: 8 }}>
                  <Space>
                    <Text strong>识别结果</Text>
                    <Tag color={confidenceColor[result.confidence]}>
                      置信度: {confidenceLabel[result.confidence]}
                    </Tag>
                  </Space>
                </div>

                <Card size="small" style={{ background: '#fff', marginBottom: 12 }}>
                  <Space direction="vertical" style={{ width: '100%' }} size="small">
                    <div>
                      <Text type="secondary">客户：</Text>
                      <Text strong>{result.draft.customerName}</Text>
                    </div>
                    <div>
                      <Text type="secondary">订单类型：</Text>
                      <Text>{result.draft.type === 'sales' ? '销售订单' : '海外提货单'}</Text>
                    </div>
                    {result.draft.deliveryDate && (
                      <div>
                        <Text type="secondary">交货日期：</Text>
                        <Text>{result.draft.deliveryDate}</Text>
                      </div>
                    )}
                    {result.missingFields.includes('deliveryDate') && (
                      <div>
                        <Text type="secondary">交货日期：</Text>
                        <Tag color="orange">未指定</Tag>
                      </div>
                    )}
                    <div>
                      <Text type="secondary">商品明细：</Text>
                    </div>
                    <div style={{ paddingLeft: 12 }}>
                      {result.draft.items.map((item, idx) => (
                        <div key={idx} style={{ marginBottom: 4 }}>
                          <Text>
                            {item.skuName} × {item.qty} @ ¥{item.unitPrice.toFixed(2)} = ¥{item.lineAmount.toFixed(2)}
                          </Text>
                        </div>
                      ))}
                    </div>
                    <div style={{ textAlign: 'right', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                      <Text strong>合计：¥{result.draft.totalAmount.toFixed(2)}</Text>
                    </div>
                    {result.draft.remark && (
                      <div>
                        <Text type="secondary">备注：</Text>
                        <Text>{result.draft.remark}</Text>
                      </div>
                    )}
                  </Space>
                </Card>

                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button icon={<CloseOutlined />} onClick={handleDiscard}>
                    丢弃
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={handleApply}
                  >
                    应用到表单
                  </Button>
                </Space>
              </>
            )}

            {!result.draft && (
              <Alert
                type="error"
                showIcon
                message="未能生成订单草稿"
                description="请检查输入内容是否包含客户名称和商品信息，或尝试更明确的描述。"
              />
            )}
          </div>
        )}
      </Space>
    </Card>
  );
}
