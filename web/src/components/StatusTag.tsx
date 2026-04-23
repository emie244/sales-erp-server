import { Tag } from 'antd';

interface Props {
  status: string;
  collectedAmount?: number;
  payAmount?: number;
  prepaymentDeducted?: number;
}

export default function StatusTag({
  status,
  collectedAmount,
  payAmount,
  prepaymentDeducted,
}: Props) {
  // 计算业务状态
  const getBusinessStatus = () => {
    if (status === 'draft') {
      return { label: '草稿', color: 'default' };
    }
    if (status === 'pending_approval') {
      return { label: '待批准', color: 'orange' };
    }
    if (status === 'rejected') {
      return { label: '已驳回', color: 'red' };
    }
    if (['approved', 'synced_jst', 'shipped'].includes(status)) {
      const totalCollected = (collectedAmount || 0) + (prepaymentDeducted || 0);
      if (totalCollected >= (payAmount || 0) - 0.01) {
        return { label: '已回款', color: 'green' };
      }
      return { label: '待回款', color: 'blue' };
    }
    if (status === 'completed') {
      return { label: '已回款', color: 'green' };
    }
    if (status === 'cancelled') {
      return { label: '已取消', color: 'red' };
    }
    return { label: status, color: 'default' };
  };

  const businessStatus = getBusinessStatus();

  return <Tag color={businessStatus.color}>{businessStatus.label}</Tag>;
}
