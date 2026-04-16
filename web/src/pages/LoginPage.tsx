import { useState } from 'react';
import { Button, Input, Form, message } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = (values: { username: string; password: string }) => {
    setLoading(true);
    setTimeout(() => {
      // MVP 阶段模拟登录，任意账号密码均可
      localStorage.setItem('erp_token', 'mock_token_' + values.username);
      message.success('登录成功');
      navigate('/dashboard');
      setLoading(false);
    }, 500);
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div
        style={{
          flex: 1.2,
          background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#fff',
          padding: 40,
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
          Sales ERP
        </div>
        <div style={{ fontSize: 16, opacity: 0.9 }}>
          智能销售管理，业务一手掌控
        </div>
      </div>
      <div
        style={{
          flex: 1,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 80px',
        }}
      >
        <div
          style={{
            fontSize: 24,
            fontWeight: 600,
            marginBottom: 32,
            color: '#262626',
          }}
        >
          账号登录
        </div>
        <Form onFinish={onFinish} layout="vertical">
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input size="large" placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password size="large" placeholder="请输入密码" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
