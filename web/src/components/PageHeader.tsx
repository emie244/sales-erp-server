import { Space } from 'antd';

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
  left?: React.ReactNode;
}

export default function PageHeader({ title, children, left }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <Space align="center">
        {left}
        <span style={{ fontSize: 16, fontWeight: 500 }}>{title}</span>
      </Space>
      {children && <Space wrap>{children}</Space>}
    </div>
  );
}
