import React from 'react';
import { Card, Statistic } from 'antd';

interface Props {
  title: string;
  value: number | string;
  prefix?: string;
  valueStyle?: React.CSSProperties;
}

export default function StatCard({ title, value, prefix, valueStyle }: Props) {
  return (
    <Card>
      <Statistic
        title={title}
        value={value}
        prefix={prefix}
        valueStyle={valueStyle}
      />
    </Card>
  );
}
