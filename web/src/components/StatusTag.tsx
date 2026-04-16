import { Tag } from 'antd';

const colorMap: Record<string, string> = {
  draft: 'default',
  pending: 'orange',
  pending_approval: 'orange',
  approved: 'green',
  synced_jst: 'green',
  shipped: 'green',
  completed: 'green',
  rejected: 'red',
  cancelled: 'red',
};

const labelMap: Record<string, string> = {
  draft: '草稿',
  pending: '待审批',
  pending_approval: '待审批',
  approved: '已通过',
  synced_jst: '已同步',
  shipped: '已发货',
  completed: '已完成',
  rejected: '已拒绝',
  cancelled: '已取消',
};

interface Props {
  status: string;
}

export default function StatusTag({ status }: Props) {
  return (
    <Tag color={colorMap[status] || 'default'}>
      {labelMap[status] || status}
    </Tag>
  );
}
