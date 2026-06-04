import { useState, useRef, useEffect } from 'react';
import {
  Card,
  Input,
  Button,
  Space,
  Spin,
  Tag,
  Empty,
  Alert,
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { chatWithAI, type ChatMessage, type ChatResponse } from '@/api/ai';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: ChatResponse['action'];
  data?: any;
  suggestions?: string[];
  loading?: boolean;
}

const quickQuestions = [
  '今天有多少订单？',
  '打开销售订单页面',
  '给上海东宜下500个Hello Kitty',
  '本月销售额多少？',
  '还有多少订单待审批？',
];

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function AiChatPanel() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '你好！我是你的 ERP 智能助手 🤖\n\n你可以这样问我：\n• 给某客户下某产品的订单\n• 今天有多少订单 / 本月销售额\n• 打开销售订单 / 客户列表\n• 库存预警 / 待审批订单',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride || input).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: text,
    };

    const assistantPlaceholder: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setInput('');
    setLoading(true);

    try {
      const history: ChatMessage[] = messages
        .filter((m) => !m.loading && m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await chatWithAI(text, history.slice(-6));

      setMessages((prev) => {
        const next = prev.slice(0, -1);
        next.push({
          id: generateId(),
          role: 'assistant',
          content: res.message,
          action: res.action,
          data: res.data,
          suggestions: res.suggestions,
        });
        return next;
      });

      // 自动执行导航
      const navAction = res.action;
      if (navAction?.type === 'navigate' && navAction.target) {
        setTimeout(() => {
          if (navAction.state) {
            navigate(navAction.target!, { state: navAction.state });
          } else {
            navigate(navAction.target!);
          }
        }, 800);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || '服务暂时不可用，请稍后重试';
      setMessages((prev) => {
        const next = prev.slice(0, -1);
        next.push({
          id: generateId(),
          role: 'assistant',
          content: `❌ ${msg}`,
        });
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (action: ChatResponse['action']) => {
    if (!action) return;
    if (action.type === 'navigate' && action.target) {
      if (action.state) {
        navigate(action.target, { state: action.state });
      } else {
        navigate(action.target);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card
      style={{
        marginBottom: 16,
        background: 'linear-gradient(135deg, #f6ffed 0%, #e6f4ff 100%)',
        borderColor: '#b7eb8f',
      }}
      bodyStyle={{ padding: '16px 20px' }}
      title={
        <Space>
          <RobotOutlined style={{ color: '#52c41a', fontSize: 18 }} />
          <span style={{ fontWeight: 600 }}>🤖 AI 智能助手</span>
        </Space>
      }
    >
      {/* 快捷问题 */}
      <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {quickQuestions.map((q) => (
          <Tag
            key={q}
            color="processing"
            style={{ cursor: 'pointer' }}
            onClick={() => handleSend(q)}
          >
            <ThunderboltOutlined /> {q}
          </Tag>
        ))}
      </div>

      {/* 消息区域 */}
      <div
        ref={scrollRef}
        style={{
          maxHeight: 360,
          minHeight: 200,
          overflowY: 'auto',
          padding: '8px 4px',
          background: '#fff',
          borderRadius: 8,
          border: '1px solid #f0f0f0',
          marginBottom: 12,
        }}
      >
        {messages.length === 0 && (
          <Empty description="开始和 AI 助手对话" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 12,
              padding: '0 8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 8,
                maxWidth: '80%',
              }}
            >
              {/* 头像 */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: msg.role === 'user' ? '#1677ff' : '#52c41a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {msg.role === 'user' ? (
                  <UserOutlined style={{ color: '#fff', fontSize: 14 }} />
                ) : (
                  <RobotOutlined style={{ color: '#fff', fontSize: 14 }} />
                )}
              </div>

              {/* 内容 */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    background: msg.role === 'user' ? '#1677ff' : '#f6ffed',
                    color: msg.role === 'user' ? '#fff' : '#333',
                    padding: '8px 12px',
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    border: msg.role === 'user' ? 'none' : '1px solid #b7eb8f',
                  }}
                >
                  {msg.loading ? (
                    <Space>
                      <Spin size="small" />
                      <span style={{ color: '#666' }}>AI 思考中...</span>
                    </Space>
                  ) : (
                    msg.content
                  )}
                </div>

                {/* 操作按钮 */}
                {msg.action && !msg.loading && (
                  <div style={{ marginTop: 8 }}>
                    {msg.action.type === 'navigate' && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<ArrowRightOutlined />}
                        onClick={() => handleActionClick(msg.action)}
                      >
                        {msg.data?.draft
                          ? '去确认下单'
                          : '打开页面'}
                      </Button>
                    )}
                    {msg.data?.warnings?.length > 0 && (
                      <Alert
                        type="warning"
                        showIcon
                        style={{ marginTop: 8, fontSize: 12 }}
                        message={msg.data.warnings.map((w: string, i: number) => (
                          <div key={i}>{w}</div>
                        ))}
                      />
                    )}
                  </div>
                )}

                {/* 建议按钮 */}
                {msg.suggestions && !msg.loading && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {msg.suggestions.map((s) => (
                      <Button key={s} size="small" onClick={() => handleSend(s)}>
                        {s}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 输入区域 */}
      <Space.Compact style={{ width: '100%' }}>
        <Input.TextArea
          placeholder="输入指令，例如：给上海东宜下500个Hello Kitty，单价45元..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          autoSize={{ minRows: 1, maxRows: 3 }}
          disabled={loading}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => handleSend()}
          loading={loading}
          disabled={!input.trim() || loading}
          style={{ height: 'auto' }}
        >
          发送
        </Button>
      </Space.Compact>

      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#999' }}>
          按 Enter 发送，Shift+Enter 换行
        </span>
        <Button
          type="link"
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => {
            setMessages([
              {
                id: 'welcome',
                role: 'assistant',
                content:
                  '你好！我是你的 ERP 智能助手 🤖\n\n你可以这样问我：\n• 给某客户下某产品的订单\n• 今天有多少订单 / 本月销售额\n• 打开销售订单 / 客户列表\n• 库存预警 / 待审批订单',
              },
            ]);
          }}
        >
          清空对话
        </Button>
      </div>
    </Card>
  );
}
