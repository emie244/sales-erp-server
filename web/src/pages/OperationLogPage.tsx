import { useEffect, useState } from 'react';
import {
  Table,
  Tag,
  Typography,
  Card,
  Space,
  Input,
  Select,
  DatePicker,
} from 'antd';
import type { TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import { getOperationLogs, type OperationLog } from '@/api/operation-logs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

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

  const [filters, setFilters] = useState({
    userName: '',
    action: '',
    resource: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  });

  const fetchLogs = async (page = 1, pageSize = 50) => {
    setLoading(true);
    try {
      const res = await getOperationLogs(page, pageSize, {
        userName: filters.userName || undefined,
        action: filters.action || undefined,
        resource: filters.resource || undefined,
        status: filters.status || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
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

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleDateChange = (
    dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null,
  ) => {
    const [start, end] = dates || [];
    if (start && end) {
      setFilters((prev) => ({
        ...prev,
        dateFrom: start.format('YYYY-MM-DD'),
        dateTo: end.format('YYYY-MM-DD'),
      }));
    } else {
      setFilters((prev) => ({ ...prev, dateFrom: '', dateTo: '' }));
    }
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
    <div style={{ width: '100%', height: 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Title level={4}>操作日志</Title>
      <Space wrap style={{ marginBottom: 16, flexShrink: 0 }}>
        <Input
          placeholder="用户"
          value={filters.userName}
          onChange={(e) => handleFilterChange('userName', e.target.value)}
          style={{ width: 140 }}
          allowClear
        />
        <Input
          placeholder="操作"
          value={filters.action}
          onChange={(e) => handleFilterChange('action', e.target.value)}
          style={{ width: 140 }}
          allowClear
        />
        <Input
          placeholder="资源"
          value={filters.resource}
          onChange={(e) => handleFilterChange('resource', e.target.value)}
          style={{ width: 140 }}
          allowClear
        />
        <Select
          placeholder="状态"
          value={filters.status || undefined}
          onChange={(v) => handleFilterChange('status', v)}
          style={{ width: 100 }}
          allowClear
          options={[
            { value: 'success', label: '成功' },
            { value: 'error', label: '失败' },
          ]}
        />
        <RangePicker onChange={handleDateChange} style={{ width: 240 }} />
        <a
          onClick={() => {
            setFilters({
              userName: '',
              action: '',
              resource: '',
              status: '',
              dateFrom: '',
              dateTo: '',
            });
            void fetchLogs(1, pagination.pageSize || 50);
          }}
        >
          重置
        </a>
        <a onClick={() => void fetchLogs(1, pagination.pageSize || 50)}>查询</a>
      </Space>
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          sticky
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200, y: 'calc(100vh - 360px)' }}
        />
      </Card>
    </div>
  );
}
