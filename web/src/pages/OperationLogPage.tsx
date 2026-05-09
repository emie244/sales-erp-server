import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Card } from 'antd';
import type { TablePaginationConfig } from 'antd/es/table';
import { getOperationLogs, type OperationLog } from '@/api/operation-logs';

const { Title } = Typography;

const statusMap: Record<string, { color: string; label: string }> = {
  success: { color: 'success', label: '成功' },
  error: { color: 'error', label: '失败' },
};

export default function OperationLogPage() {
  const [data, setData] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 50,
    total: 0,
  });

  const fetchLogs = async (page = 1, pageSize = 50) => {
    setLoading(true);
    try {
      const res = await getOperationLogs(page, pageSize);
      setData(res.data);
      setPagination({
        current: res.page,
        pageSize: res.pageSize,
        total: res.total,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLogs();
  }, []);

  const handleTableChange = (newPagination: TablePaginationConfig) => {
    void fetchLogs(newPagination.current || 1, newPagination.pageSize || 50);
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '用户',
      dataIndex: 'userName',
      width: 120,
      render: (v: string | null) => v || '-',
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 200,
    },
    {
      title: '资源',
      dataIndex: 'resource',
      width: 120,
    },
    {
      title: '资源ID',
      dataIndex: 'resourceId',
      width: 120,
      render: (v: string | null) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: string) => {
        const info = statusMap[v] || { color: 'default', label: v };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: '耗时(ms)',
      dataIndex: ['details', 'durationMs'],
      width: 100,
      render: (_v: unknown, record: OperationLog) =>
        record.details?.durationMs ?? '-',
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      width: 140,
      render: (v: string | null) => v || '-',
    },
    {
      title: '错误信息',
      dataIndex: 'errorMessage',
      ellipsis: true,
      render: (v: string | undefined) => v || '-',
    },
  ];

  return (
    <div>
      <Title level={4}>操作日志</Title>
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
}
