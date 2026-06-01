import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import BomManagement from '@/components/BomManagement';
import PageHeader from '@/components/PageHeader';

export default function BomPage() {
  const navigate = useNavigate();

  return (
    <div style={{ width: '100%' }}>
      <PageHeader title="BOM 管理">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
      </PageHeader>
      <BomManagement />
    </div>
  );
}
