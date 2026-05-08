import { Space } from 'antd';

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 500 }}>{title}</span>
      {children && <Space>{children}</Space>}
    </div>
  );
}
