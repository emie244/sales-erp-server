import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Space,
  Tabs,
  Tag,
  Input,
  Statistic,
  Row,
  Col,
  Card,
  Empty,
} from 'antd';
import { ExclamationCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { fetchStocks, type StockItem } from '@/api/stocks';
import PageHeader from '@/components/PageHeader';

function AlertTable({ status, keyword }: { status: 'danger' | 'warning'; keyword?: string }) {
  const [data, setData] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchStocks({
        page: 1,
        pageSize: 200,
        status,
        keyword: keyword || undefined,
      });
      setData(res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [status, keyword]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      title: 'SKU图片',
      key: 'pic',
      width: 80,
      render: (_: any, record: StockItem) => (
        <img
          referrerPolicy="no-referrer"
          src={record.pic || 'https://placehold.co/48x48?text=No+Image'}
          alt=""
          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
        />
      ),
    },
    {
      title: 'SKU名称',
      key: 'skuName',
      render: (_: any, record: StockItem) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.skuName || '-'}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.skuCode || record.skuId}</div>
        </div>
      ),
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      key: 'productName',
      render: (v?: string) => v || '-',
    },
    {
      title: '仓库',
      dataIndex: 'warehouseId',
      key: 'warehouseId',
      width: 120,
    },
    {
      title: '可用库存',
      dataIndex: 'availableQty',
      key: 'availableQty',
      width: 100,
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: Number(v || 0) <= 0 ? '#ff4d4f' : '#fa8c16', fontWeight: 600 }}>
          {v}
        </span>
      ),
    },
    {
      title: '安全库存',
      dataIndex: 'safetyStock',
      key: 'safetyStock',
      width: 100,
      align: 'right' as const,
      render: (v: number) => v || '-',
    },
    {
      title: '缺口',
      key: 'gap',
      width: 100,
      align: 'right' as const,
      render: (_: any, record: StockItem) => {
        const gap = Number(record.safetyStock || 0) - Number(record.availableQty || 0);
        return (
          <Tag color={status === 'danger' ? 'error' : 'warning'}>
            {gap > 0 ? `-${gap.toFixed(2)}` : '0'}
          </Tag>
        );
      },
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey={(r) => `${r.skuId}-${r.warehouseId}`}
      loading={loading}
      pagination={false}
      size="middle"
      scroll={{ x: 900 }}
      locale={{ emptyText: <Empty description={`暂无${status === 'danger' ? '缺货' : '预警'}记录`} /> }}
    />
  );
}

export default function StockAlertPage() {
  const [activeKey, setActiveKey] = useState('danger');
  const [keyword, setKeyword] = useState('');
  const [dangerCount, setDangerCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    Promise.all([
      fetchStocks({ page: 1, pageSize: 1, status: 'danger' }),
      fetchStocks({ page: 1, pageSize: 1, status: 'warning' }),
    ]).then(([danger, warning]) => {
      setDangerCount(danger.total || 0);
      setWarningCount(warning.total || 0);
    });
  }, [trigger]);

  const handleSearch = () => {
    setTrigger((v) => v + 1);
  };

  return (
    <div>
      <PageHeader title="库存预警" />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="缺货预警"
              value={dangerCount}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="库存预警"
              value={warningCount}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="预警总数"
              value={dangerCount + warningCount}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索 SKU/产品名"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={handleSearch}
          style={{ width: 260 }}
          allowClear
        />
        <Button type="primary" onClick={handleSearch}>
          查询
        </Button>
      </Space>

      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        items={[
          {
            key: 'danger',
            label: (
              <span>
                <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                缺货预警 ({dangerCount})
              </span>
            ),
            children: <AlertTable status="danger" keyword={keyword} key={`danger-${trigger}`} />,
          },
          {
            key: 'warning',
            label: (
              <span>
                <WarningOutlined style={{ color: '#fa8c16' }} />
                库存预警 ({warningCount})
              </span>
            ),
            children: <AlertTable status="warning" keyword={keyword} key={`warning-${trigger}`} />,
          },
        ]}
      />
    </div>
  );
}
