import { useEffect, useState } from 'react';
import { Card, Spin, Space, Tag, Button, Empty, Statistic, Row, Col } from 'antd';
import { ShoppingOutlined, WarningOutlined, StockOutlined, HistoryOutlined } from '@ant-design/icons';
import { fetchCustomerRecommendations, type TopSku } from '@/api/ai';

interface Props {
  customerId: string;
  onAddItem: (item: {
    productId: string;
    skuId: string;
    skuCode: string;
    skuName: string;
    qty: number;
    unitPrice: number;
  }) => void;
}

export default function CustomerRecommendationPanel({ customerId, onAddItem }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    creditStatus: { creditLimit: number; usedCredit: number; isBlocked: boolean };
    topSkus: TopSku[];
  } | null>(null);

  useEffect(() => {
    if (!customerId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetchCustomerRecommendations(customerId)
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [customerId]);

  if (!customerId) return null;

  return (
    <Card
      size="small"
      style={{ marginBottom: 16, background: '#e6f4ff', borderColor: '#91caff' }}
      title={
        <Space>
          <ShoppingOutlined style={{ color: '#1677ff' }} />
          <span>客户销售推荐</span>
        </Space>
      }
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin tip="加载推荐数据..." />
        </div>
      )}

      {!loading && data && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* 信用状态 */}
          {data.creditStatus.isBlocked ? (
            <Tag color="error" icon={<WarningOutlined />}>
              该客户已被信用冻结
            </Tag>
          ) : (
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="信用额度"
                  value={data.creditStatus.creditLimit}
                  prefix="¥"
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="已用信用"
                  value={data.creditStatus.usedCredit}
                  prefix="¥"
                  valueStyle={{ fontSize: 14, color: data.creditStatus.usedCredit > data.creditStatus.creditLimit * 0.8 ? '#ff4d4f' : undefined }}
                />
              </Col>
            </Row>
          )}

          {/* Top SKU 列表 */}
          {data.topSkus.length > 0 ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                <HistoryOutlined style={{ marginRight: 4 }} />
                历史常购 SKU（按累计采购量排序）
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {data.topSkus.map((sku) => (
                  <div
                    key={sku.skuId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#fff',
                      borderRadius: 6,
                      border: '1px solid #f0f0f0',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {sku.skuName}
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                        累计采购 {sku.totalQty} 个 · 均单价 ¥{sku.avgPrice.toFixed(2)}
                        {sku.stockQty <= 0 && (
                          <Tag color="error" style={{ marginLeft: 8, fontSize: 12 }}>
                            缺货
                          </Tag>
                        )}
                        {sku.stockQty > 0 && sku.stockQty < 50 && (
                          <Tag color="warning" style={{ marginLeft: 8, fontSize: 12 }}>
                            库存紧张
                          </Tag>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                        <StockOutlined /> 库存: {sku.stockQty} · 上次采购: {sku.lastOrderDate ? new Date(sku.lastOrderDate).toLocaleDateString('zh-CN') : '-'}
                      </div>
                    </div>
                    <Button
                      type="primary"
                      size="small"
                      onClick={() =>
                        onAddItem({
                          productId: sku.productId,
                          skuId: sku.skuId,
                          skuCode: sku.skuCode,
                          skuName: sku.skuName,
                          qty: Math.max(1, Math.round(sku.totalQty / Math.max(sku.orderCount, 1))),
                          unitPrice: sku.avgPrice,
                        })
                      }
                      disabled={data.creditStatus.isBlocked}
                    >
                      加入订单
                    </Button>
                  </div>
                ))}
              </Space>
            </div>
          ) : (
            <Empty description="该客户暂无历史采购记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Space>
      )}
    </Card>
  );
}
