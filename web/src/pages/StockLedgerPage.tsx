import { useEffect, useState } from 'react';
import { Table, Button, Modal, Tag, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { fetchLocalBalances, fetchLedgerBySku } from '@/api/stocks';
import type { LocalStockBalance, StockLedgerEntry } from '@/api/stocks';
import PageHeader from '@/components/PageHeader';

export default function StockLedgerPage() {
  const [balances, setBalances] = useState<LocalStockBalance[]>([]);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balancePage, setBalancePage] = useState(1);
  const [balancePageSize, setBalancePageSize] = useState(20);
  const [balanceTotal, setBalanceTotal] = useState(0);

  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerSkuId, setLedgerSkuId] = useState('');
  const [ledgerData, setLedgerData] = useState<StockLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(20);
  const [ledgerTotal, setLedgerTotal] = useState(0);

  const loadBalances = async (p = balancePage, ps = balancePageSize) => {
    setBalanceLoading(true);
    try {
      const res = await fetchLocalBalances({ page: p, pageSize: ps });
      setBalances(res.data);
      setBalanceTotal(res.total);
    } catch {
      message.error('加载库存余额失败');
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    loadBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balancePage, balancePageSize]);

  const loadLedger = async (skuId: string, p = ledgerPage, ps = ledgerPageSize) => {
    setLedgerLoading(true);
    try {
      const res = await fetchLedgerBySku(skuId, { page: p, pageSize: ps });
      setLedgerData(res.data);
      setLedgerTotal(res.total);
    } catch {
      message.error('加载流水失败');
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleViewLedger = (skuId: string) => {
    setLedgerSkuId(skuId);
    setLedgerPage(1);
    setLedgerOpen(true);
    loadLedger(skuId, 1, ledgerPageSize);
  };

  const balanceColumns = [
    { title: 'SKU ID', dataIndex: 'skuId', key: 'skuId', width: 200 },
    {
      title: '当前数量',
      dataIndex: 'qty',
      key: 'qty',
      align: 'right' as const,
      render: (v: number) => Number(v).toFixed(4),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: LocalStockBalance) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewLedger(record.skuId)}
        >
          查看流水
        </Button>
      ),
    },
  ];

  const ledgerColumns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (v: string) =>
        v === 'inbound' ? (
          <Tag color="green">入库</Tag>
        ) : (
          <Tag color="red">出库</Tag>
        ),
    },
    {
      title: '数量',
      dataIndex: 'qty',
      key: 'qty',
      align: 'right' as const,
      render: (v: number) => Number(v).toFixed(4),
    },
    {
      title: '关联单据',
      key: 'ref',
      render: (_: any, r: StockLedgerEntry) => (
        <span>
          {r.referenceType}:{r.referenceId}
        </span>
      ),
    },
    {
      title: '变动前',
      dataIndex: 'beforeQty',
      key: 'beforeQty',
      align: 'right' as const,
      render: (v: number) => Number(v).toFixed(4),
    },
    {
      title: '变动后',
      dataIndex: 'afterQty',
      key: 'afterQty',
      align: 'right' as const,
      render: (v: number) => Number(v).toFixed(4),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 104px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader title="库存流水" />

      <Table
        rowKey="id"
        columns={balanceColumns}
        dataSource={balances}
        loading={balanceLoading}
        sticky
        scroll={{ x: 600, y: 'calc(100vh - 360px)' }}
        pagination={{
          current: balancePage,
          pageSize: balancePageSize,
          total: balanceTotal,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setBalancePage(p);
            setBalancePageSize(ps);
          },
        }}
      />

      <Modal
        title={`SKU 流水: ${ledgerSkuId}`}
        open={ledgerOpen}
        onCancel={() => setLedgerOpen(false)}
        footer={null}
        width={900}
      >
        <Table
          rowKey="id"
          columns={ledgerColumns}
          dataSource={ledgerData}
          loading={ledgerLoading}
          pagination={{
            current: ledgerPage,
            pageSize: ledgerPageSize,
            total: ledgerTotal,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setLedgerPage(p);
              setLedgerPageSize(ps);
              loadLedger(ledgerSkuId, p, ps);
            },
          }}
        />
      </Modal>
    </div>
  );
}
