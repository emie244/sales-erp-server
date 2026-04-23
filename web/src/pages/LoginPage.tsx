import { useEffect, useState } from 'react';
import { Button, Input, Form, message, Divider } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { login, getFeishuLoginUrl } from '@/api/auth';
import { setUserPermissions } from '@/utils/permissions';

function storeFeishuId(user: any) {
  const bestId = user?.feishuUserId || user?.feishuOpenId;
  if (bestId) {
    localStorage.setItem('erp_feishu_user_id', bestId);
    localStorage.setItem(
      'erp_feishu_user_id_type',
      user?.feishuUserId ? 'user_id' : 'open_id',
    );
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const name = searchParams.get('name');
    const feishuUserId = searchParams.get('feishuUserId');
    const feishuUserIdType = searchParams.get('feishuUserIdType');
    const error = searchParams.get('error');

    if (error) {
      message.error(decodeURIComponent(error));
      return;
    }

    if (token) {
      localStorage.setItem('erp_token', token);
      if (name) {
        localStorage.setItem('erp_username', decodeURIComponent(name));
      }
      if (feishuUserId) {
        localStorage.setItem(
          'erp_feishu_user_id',
          decodeURIComponent(feishuUserId),
        );
      }
      if (feishuUserIdType) {
        localStorage.setItem(
          'erp_feishu_user_id_type',
          decodeURIComponent(feishuUserIdType),
        );
      }
      const base64Payload = token.split('.')[1];
      const base64 = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
      const pad =
        base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
      const payload = JSON.parse(atob(base64 + pad));
      if (payload.role) {
        localStorage.setItem('erp_role', payload.role);
      }
      if (payload.permissions) {
        setUserPermissions(payload.permissions);
      }
      message.success('飞书登录成功');
      navigate('/dashboard', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await login(values.username, values.password);
      localStorage.setItem('erp_token', res.token);
      localStorage.setItem('erp_username', res.user.name);
      localStorage.setItem('erp_role', res.user.role);
      if (res.user.permissions) {
        setUserPermissions(res.user.permissions);
      }
      storeFeishuId(res.user);
      message.success('登录成功');
      navigate('/dashboard');
    } catch {
      message.error('登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFeishuLogin = async () => {
    try {
      const res = await getFeishuLoginUrl();
      window.location.href = res.url;
    } catch {
      message.error('获取飞书登录链接失败');
    }
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
        <Button
          size="large"
          block
          style={{ background: '#3370ff', color: '#fff', marginBottom: 16 }}
          onClick={handleFeishuLogin}
        >
          飞书扫码登录
        </Button>
        <Divider plain>或</Divider>
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
