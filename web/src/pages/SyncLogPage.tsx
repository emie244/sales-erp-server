import { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Space,
  Select,
  Drawer,
  Card,
  Badge,
  Empty,
  message,
  DatePicker,
  Button,
  Input,
} from 'antd';
import type { Dayjs } from 'dayjs';
import {
  EyeOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LinkOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  fetchSyncLogs,
  fetchMonthlyAggregate,
  type SyncLog,
  type MonthlyAggregate,
} from '@/api/sync-logs';
import PageHeader from '@/components/PageHeader';

const jobNameMap: Record<string, string> = {
  'sync-stock': '同步库存',
  'sync-deliveries': '同步出库单',
  'sync-skus': '同步 SKU',
  'push-order': '推送订单',
};

const statusMap: Record<string, { label: string; color: string }> = {
  running: { label: '运行中', color: 'processing' },
  succeeded: { label: '成功', color: 'success' },
  failed: { label: '失败', color: 'error' },
  partial: { label: '部分成功', color: 'warning' },
};

export default function SyncLogPage() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [jobName, setJobName] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);
  const [keyword, setKeyword] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('startedAt:desc');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<SyncLog | null>(null);

  const [monthlyData, setMonthlyData] = useState<MonthlyAggregate[]>([]);

  const latestSkuSync = logs.find((l) => l.jobName === 'sync-skus');
  const tokenExpired =
    latestSkuSync?.status === 'failed' &&
    latestSkuSync.errors.some(
      (e) =>
        e.message.includes('token') ||
        e.message.includes('令牌') ||
        e.message.includes('过期') ||
        e.message.includes('无效') ||
        e.message.includes('refresh') ||
        e.message.includes('access_token'),
    );

  const connectionStatus = tokenExpired
    ? ({ type: 'error' } as const)
    : latestSkuSync?.status === 'succeeded'
      ? ({ type: 'ok' } as const)
      : ({ type: 'unknown' } as const);
  const [monthlyJobName, setMonthlyJobName] = useState<string>('sync-skus');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchSyncLogs({
        jobName: jobName || undefined,
        limit: 200,
      });
      let filtered = res;
      if (status) {
        filtered = filtered.filter((l) => l.status === status);
      }
      if (dateRange?.[0] && dateRange?.[1]) {
        const start = dateRange[0].startOf('day').valueOf();
        const end = dateRange[1].endOf('day').valueOf();
        filtered = filtered.filter((l) => {
          const t = new Date(l.startedAt).getTime();
          return t >= start && t <= end;
        });
      }
      if (keyword.trim()) {
        const k = keyword.trim().toLowerCase();
        filtered = filtered.filter(
          (l) =>
            (jobNameMap[l.jobName] || l.jobName).toLowerCase().includes(k) ||
            l.status.toLowerCase().includes(k) ||
            l.triggeredBy.toLowerCase().includes(k) ||
            l.errors.some((e) =>
              (e.message || '').toLowerCase().includes(k),
            ),
        );
      }
      if (sortBy) {
        const [field, order] = sortBy.split(':');
        filtered = [...filtered].sort((a, b) => {
          let av = 0;
          let bv = 0;
          if (field === 'startedAt') {
            av = new Date(a.startedAt).getTime();
            bv = new Date(b.startedAt).getTime();
          }
          return order === 'asc' ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
        });
      }
      setLogs(filtered);
    } catch {
      message.error('加载同步日志失败');
    } finally {
      setLoading(false);
    }
  };

  const loadMonthly = async () => {
    if (!monthlyJobName) return;
    try {
      const res = await fetchMonthlyAggregate({
        jobName: monthlyJobName,
        months: 12,
      });
      setMonthlyData(res);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobName, sortBy]);

  useEffect(() => {
    loadMonthly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlyJobName]);

  const openDetail = (record: SyncLog) => {
    setDetailRecord(record);
    setDetailOpen(true);
  };

  const duration = (record: SyncLog) => {
    if (!record.finishedAt) return '-';
    const start = new Date(record.startedAt).getTime();
    const end = new Date(record.finishedAt).getTime();
    const sec = Math.round((end - start) / 1000);
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  };

  const columns = [
    {
      title: '任务',
      dataIndex: 'jobName',
      key: 'jobName',
      width: 120,
      render: (v: string) => jobNameMap[v] || v,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => {
        const map = statusMap[v] || { label: v, color: 'default' };
        return <Badge status={map.color as any} text={map.label} />;
      },
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 180,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '耗时',
      key: 'duration',
      width: 80,
      render: (_: unknown, record: SyncLog) => duration(record),
    },
    {
      title: '拉取',
      dataIndex: 'fetchedCount',
      key: 'fetchedCount',
      width: 70,
      align: 'right' as const,
    },
    {
      title: '新建',
      dataIndex: 'insertedCount',
      key: 'insertedCount',
      width: 70,
      align: 'right' as const,
    },
    {
      title: '更新',
      dataIndex: 'updatedCount',
      key: 'updatedCount',
      width: 70,
      align: 'right' as const,
    },
    {
      title: '跳过',
      dataIndex: 'skippedCount',
      key: 'skippedCount',
      width: 70,
      align: 'right' as const,
      render: (v: number) =>
        v > 0 ? <span style={{ color: '#fa8c16' }}>{v}</span> : v,
    },
    {
      title: '未归类',
      dataIndex: 'itemTypeNullCount',
      key: 'itemTypeNullCount',
      width: 80,
      align: 'right' as const,
      render: (v: number) =>
        v > 0 ? <Tag color="warning">{v}</Tag> : <span>{v}</span>,
    },
    {
      title: '不合规',
      dataIndex: 'codeNonCompliantCount',
      key: 'codeNonCompliantCount',
      width: 80,
      align: 'right' as const,
      render: (v: number) =>
        v > 0 ? <Tag color="error">{v}</Tag> : <span>{v}</span>,
    },
    {
      title: '触发方式',
      dataIndex: 'triggeredBy',
      key: 'triggeredBy',
      width: 90,
      render: (v: string) =>
        v === 'cron'
          ? '定时'
          : v === 'manual'
            ? '手动'
            : v === 'webhook'
              ? 'Webhook'
              : v,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right' as const,
      render: (_: unknown, record: SyncLog) => (
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => openDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="聚水潭同步日志" />

      {connectionStatus.type === 'error' && (
        <Card
          size="small"
          style={{
            marginBottom: 16,
            borderColor: '#ff4d4f',
            background: '#fff2f0',
          }}
        >
          <Space>
            <ExclamationCircleOutlined
              style={{ color: '#ff4d4f', fontSize: 18 }}
            />
            <span style={{ fontWeight: 600, color: '#cf1322' }}>
              聚水潭 token 已过期
            </span>
          </Space>
          <div style={{ marginTop: 8, color: '#595959', lineHeight: 1.8 }}>
            <div>最近同步 SKU 任务失败，检测到 token 过期错误。</div>
            <div>续期步骤：</div>
            <ol style={{ margin: '4px 0', paddingLeft: 20 }}>
              <li>
                登录
                <a
                  href="https://open.jushuitan.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ margin: '0 4px' }}
                >
                  <LinkOutlined /> 聚水潭开放平台
                </a>
                后台
              </li>
              <li>
                进入「应用管理」→ 找到 OpenClaw 应用 → 重新授权获取 access_token
              </li>
              <li>将新的 access_token 和 refresh_token 填入服务器 .env 文件</li>
              <li>在服务器执行 docker compose down && docker compose up -d</li>
              <li>返回本页面点击「刷新」，确认 sync-skus 任务恢复成功</li>
            </ol>
          </div>
        </Card>
      )}

      {connectionStatus.type === 'ok' && latestSkuSync && (
        <Card
          size="small"
          style={{
            marginBottom: 16,
            borderColor: '#52c41a',
            background: '#f6ffed',
          }}
        >
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
            <span style={{ fontWeight: 600, color: '#237804' }}>
              聚水潭连接正常
            </span>
            <span style={{ color: '#595959' }}>
              最近同步时间：
              {new Date(latestSkuSync.startedAt).toLocaleString('zh-CN')}
            </span>
          </Space>
        </Card>
      )}

      <Space wrap style={{ marginBottom: 16, flexShrink: 0 }} className="page-search-bar">
        <Input
          placeholder="搜索任务/状态/触发方式/错误"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={load}
          style={{ width: 260 }}
          prefix={<SearchOutlined />}
        />
        <Select
          placeholder="任务类型"
          value={jobName || undefined}
          onChange={(v) => setJobName(v)}
          style={{ width: 140 }}
          allowClear
        >
          <Select.Option value="sync-stock">同步库存</Select.Option>
          <Select.Option value="sync-deliveries">同步出库单</Select.Option>
          <Select.Option value="sync-skus">同步 SKU</Select.Option>
          <Select.Option value="push-order">推送订单</Select.Option>
        </Select>
        <Select
          placeholder="状态"
          value={status || undefined}
          onChange={(v) => setStatus(v)}
          style={{ width: 120 }}
          allowClear
        >
          <Select.Option value="running">运行中</Select.Option>
          <Select.Option value="succeeded">成功</Select.Option>
          <Select.Option value="failed">失败</Select.Option>
          <Select.Option value="partial">部分成功</Select.Option>
        </Select>
        <DatePicker.RangePicker
          value={dateRange as any}
          onChange={(v) => setDateRange(v as any)}
        />
        <Select
          placeholder="排序"
          value={sortBy || undefined}
          onChange={setSortBy}
          style={{ width: 160 }}
          allowClear
        >
          <Select.Option value="startedAt:desc">开始时间从新到旧</Select.Option>
          <Select.Option value="startedAt:asc">开始时间从旧到新</Select.Option>
        </Select>
        <Button type="primary" onClick={load} icon={<ReloadOutlined />}>
          刷新
        </Button>
        <Button
          onClick={() => {
            setKeyword('');
            setJobName('');
            setStatus('');
            setDateRange(null);
            setSortBy('startedAt:desc');
            load();
          }}
        >
          重置
        </Button>
      </Space>

      <Card
        size="small"
        title="月度聚合"
        style={{ marginBottom: 16 }}
        extra={
          <Select
            value={monthlyJobName}
            onChange={setMonthlyJobName}
            style={{ width: 140 }}
            size="small"
          >
            <Select.Option value="sync-skus">同步 SKU</Select.Option>
            <Select.Option value="sync-stock">同步库存</Select.Option>
            <Select.Option value="sync-deliveries">同步出库单</Select.Option>
            <Select.Option value="push-order">推送订单</Select.Option>
          </Select>
        }
      >
        {monthlyData.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
        ) : (
          <Table
            size="small"
            pagination={false}
            columns={[
              { title: '月份', dataIndex: 'month', key: 'month' },
              {
                title: '未归类累计',
                dataIndex: 'itemTypeNullSum',
                key: 'itemTypeNullSum',
                align: 'right' as const,
                render: (v: number) =>
                  v > 0 ? <Tag color="warning">{v}</Tag> : v,
              },
              {
                title: '不合规累计',
                dataIndex: 'codeNonCompliantSum',
                key: 'codeNonCompliantSum',
                align: 'right' as const,
                render: (v: number) =>
                  v > 0 ? <Tag color="error">{v}</Tag> : v,
              },
              {
                title: '任务次数',
                dataIndex: 'jobCount',
                key: 'jobCount',
                align: 'right' as const,
              },
            ]}
            dataSource={monthlyData}
            rowKey="month"
          />
        )}
      </Card>

      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        sticky
        pagination={{ pageSize: 50 }}
        scroll={{ x: 1200, y: 'calc(100vh - 360px)' }}
      />

      <Drawer
        title="同步日志详情"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={640}
      >
        {detailRecord && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Card size="small" title="基本信息">
              <div style={{ lineHeight: 2 }}>
                <div>
                  <strong>任务：</strong>
                  {jobNameMap[detailRecord.jobName] || detailRecord.jobName}
                </div>
                <div>
                  <strong>状态：</strong>
                  <Tag color={statusMap[detailRecord.status]?.color}>
                    {statusMap[detailRecord.status]?.label}
                  </Tag>
                </div>
                <div>
                  <strong>开始：</strong>
                  {new Date(detailRecord.startedAt).toLocaleString('zh-CN')}
                </div>
                <div>
                  <strong>结束：</strong>
                  {detailRecord.finishedAt
                    ? new Date(detailRecord.finishedAt).toLocaleString('zh-CN')
                    : '-'}
                </div>
                <div>
                  <strong>耗时：</strong>
                  {duration(detailRecord)}
                </div>
                <div>
                  <strong>触发：</strong>
                  {detailRecord.triggeredBy === 'cron'
                    ? '定时'
                    : detailRecord.triggeredBy === 'manual'
                      ? '手动'
                      : detailRecord.triggeredBy}
                </div>
                {detailRecord.bullJobId && (
                  <div>
                    <strong>Bull Job ID：</strong>
                    {detailRecord.bullJobId}
                  </div>
                )}
              </div>
            </Card>

            <Card size="small" title="计数">
              <div style={{ lineHeight: 2 }}>
                <div>
                  <strong>拉取数量：</strong>
                  {detailRecord.fetchedCount}
                </div>
                <div>
                  <strong>新建数量：</strong>
                  {detailRecord.insertedCount}
                </div>
                <div>
                  <strong>更新数量：</strong>
                  {detailRecord.updatedCount}
                </div>
                <div>
                  <strong>跳过数量：</strong>
                  {detailRecord.skippedCount}
                </div>
                <div>
                  <strong>未归类 (itemType null)：</strong>
                  {detailRecord.itemTypeNullCount}
                </div>
                <div>
                  <strong>不合规编码：</strong>
                  {detailRecord.codeNonCompliantCount}
                </div>
              </div>
            </Card>

            <Card
              size="small"
              title={`错误详情 (${detailRecord.errors.length})`}
            >
              {detailRecord.errors.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="无错误"
                />
              ) : (
                <Space
                  direction="vertical"
                  style={{ width: '100%' }}
                  size="small"
                >
                  {detailRecord.errors.map((err, idx) => (
                    <Card
                      key={idx}
                      size="small"
                      type="inner"
                      title={err.skuCode || `错误 #${idx + 1}`}
                    >
                      <div style={{ color: '#cf1322', marginBottom: 8 }}>
                        {err.message}
                      </div>
                      {err.stack && (
                        <pre
                          style={{
                            background: '#f5f5f5',
                            padding: 8,
                            borderRadius: 4,
                            fontSize: 12,
                            overflow: 'auto',
                            maxHeight: 200,
                          }}
                        >
                          {err.stack}
                        </pre>
                      )}
                    </Card>
                  ))}
                </Space>
              )}
            </Card>
          </Space>
        )}
      </Drawer>
    </div>
  );
}
