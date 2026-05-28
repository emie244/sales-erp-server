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
      return { label: '草稿', bg: '#F0E6FF', text: '#7B68EE' };
    }
    if (status === 'pending_approval') {
      return { label: '待批准', bg: '#FFF8E7', text: '#F4D03F' };
    }
    if (status === 'rejected') {
      return { label: '已驳回', bg: '#FFEBEE', text: '#E83E3E' };
    }
    if (status === 'processing') {
      return { label: '加工中', bg: '#FFF3E0', text: '#FF9800' };
    }
    if (status === 'ready_to_ship') {
      return { label: '待发货', bg: '#E3F2FD', text: '#2196F3' };
    }
    if (['approved', 'synced_jst', 'shipped'].includes(status)) {
      const totalCollected = (collectedAmount || 0) + (prepaymentDeducted || 0);
      if (totalCollected >= (payAmount || 0) - 0.01) {
        return { label: '已回款', bg: '#E8F5E9', text: '#52A47A' };
      }
      return { label: '待回款', bg: '#E0F7FA', text: '#4DB6AC' };
    }
    if (status === 'completed') {
      return { label: '已回款', bg: '#E8F5E9', text: '#52A47A' };
    }
    if (status === 'cancelled') {
      return { label: '已取消', bg: '#FFEBEE', text: '#E83E3E' };
    }
    return { label: status, bg: '#F0E6FF', text: '#A0A0A0' };
  };

  const businessStatus = getBusinessStatus();

  return (
    <Tag
      style={{
        background: businessStatus.bg,
        color: businessStatus.text,
        border: 'none',
        borderRadius: 12,
        fontWeight: 500,
      }}
    >
      {businessStatus.label}
    </Tag>
  );
}
