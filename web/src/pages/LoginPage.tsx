import { useEffect, useState } from 'react';
import { Button, message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getFeishuLoginUrl } from '@/api/auth';
import { setUserPermissions } from '@/utils/permissions';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const name = searchParams.get('name');
    const feishuUserId = searchParams.get('feishuUserId');
    const feishuUserIdType = searchParams.get('feishuUserIdType');
    const avatar = searchParams.get('avatar');
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
      if (avatar) {
        localStorage.setItem('erp_avatar', decodeURIComponent(avatar));
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

  const handleFeishuLogin = async () => {
    setLoading(true);
    try {
      const res = await getFeishuLoginUrl();
      window.location.href = res.url;
    } catch {
      message.error('获取飞书登录链接失败');
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div
        style={{
          flex: 1.2,
          background:
            'linear-gradient(135deg, #FFB7C5 0%, #F8BBD0 50%, #A8E6CF 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#fff',
          padding: 40,
        }}
      >
        <div
          style={{
            fontSize: 40,
            fontWeight: 700,
            marginBottom: 16,
            letterSpacing: '1px',
          }}
        >
          <span style={{ marginRight: 8 }}>&#9829;</span> Sales ERP
        </div>
        <div style={{ fontSize: 16, opacity: 0.95, fontWeight: 500 }}>
          智能销售管理，业务一手掌控
        </div>
        <div style={{ marginTop: 32, fontSize: 48, opacity: 0.8 }}>
          &#127775; &#127752; &#127800;
        </div>
      </div>
      <div
        style={{
          flex: 1,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0 80px',
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 32,
            color: '#4A4A4A',
          }}
        >
          欢迎回来 <span style={{ fontSize: 24 }}>&#127773;</span>
        </div>
        <div style={{ textAlign: 'center', width: 280 }}>
          <Button
            size="large"
            loading={loading}
            style={{
              width: '100%',
              height: 56,
              background: '#3370ff',
              color: '#fff',
              borderRadius: 28,
              fontWeight: 700,
              fontSize: 18,
              border: 'none',
              boxShadow: '0 8px 24px rgba(51, 112, 255, 0.35)',
            }}
            onClick={handleFeishuLogin}
          >
            <span style={{ fontSize: 22, marginRight: 8 }}>&#128246;</span>
            飞书扫码登录
          </Button>
          <div style={{ marginTop: 16, fontSize: 13, color: '#9B9B9B' }}>
            请使用飞书 App 扫描二维码登录
          </div>
        </div>
      </div>
    </div>
  );
}
