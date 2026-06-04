import { useState, useRef, useEffect } from 'react';
import {
  Drawer,
  Input,
  Button,
  Space,
  Spin,
  Tag,
  Empty,
  Alert,
  Badge,
} from 'antd';
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  CloseOutlined,
  MessageOutlined,
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
  '打开销售订单',
  '给上海东宜下500个Hello Kitty',
  '本月销售额多少？',
  '还有多少待审批？',
];

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

export default function AiChatDrawer() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
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
  const [hasNewMessage, setHasNewMessage] = useState(false);
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

      if (!open) {
        setHasNewMessage(true);
      }

      // 自动执行导航
      const navAction = res.action;
      if (navAction?.type === 'navigate' && navAction.target) {
        setTimeout(() => {
          setOpen(false);
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
      setOpen(false);
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

  const handleOpen = () => {
    setOpen(true);
    setHasNewMessage(false);
  };

  return (
    <>
      {/* 悬浮按钮 */}
      <div
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 1000,
        }}
      >
        <Badge dot={hasNewMessage} color="#ff4d4f">
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={<MessageOutlined style={{ fontSize: 20 }} />}
            onClick={handleOpen}
            style={{
              width: 56,
              height: 56,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          />
        </Badge>
      </div>

      {/* 聊天抽屉 */}
      <Drawer
        title={
          <Space>
            <RobotOutlined style={{ color: '#52c41a', fontSize: 18 }} />
            <span style={{ fontWeight: 600 }}>🤖 AI 智能助手</span>
          </Space>
        }
        placement="right"
        width={480}
        onClose={() => setOpen(false)}
        open={open}
        bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}
        extra={
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={() => setOpen(false)}
          />
        }
      >
        {/* 快捷问题 */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
            <ThunderboltOutlined /> 快捷指令
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {quickQuestions.map((q) => (
              <Tag
                key={q}
                color="processing"
                style={{ cursor: 'pointer' }}
                onClick={() => handleSend(q)}
              >
                {q}
              </Tag>
            ))}
          </div>
        </div>

        {/* 消息区域 */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 16px',
            background: '#f7f8fa',
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
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                  maxWidth: '85%',
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
                      background: msg.role === 'user' ? '#1677ff' : '#fff',
                      color: msg.role === 'user' ? '#fff' : '#333',
                      padding: '8px 12px',
                      borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      fontSize: 13,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      border: msg.role === 'user' ? 'none' : '1px solid #e8e8e8',
                      boxShadow: msg.role === 'user' ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
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
                          {msg.data?.draft ? '去确认下单' : '打开页面'}
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
        <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', background: '#fff' }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input.TextArea
              placeholder="输入指令，按 Enter 发送..."
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
          <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#bbb' }}>
              Enter 发送，Shift+Enter 换行
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
              清空
            </Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
