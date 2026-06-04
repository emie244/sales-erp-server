import { useState } from 'react';
import {
  Modal,
  Button,
  Upload,
  Table,
  Alert,
  Space,
  Tag,
  message,
  Steps,
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { importProducts } from '@/api/products';

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
}

interface ProductImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const TEMPLATE_HEADERS = [
  '产品名称',
  '分类',
  '物料类型',
  'SKU名称',
  '规格',
  '销售价',
  '成本价',
  '重量(kg)',
  '品牌',
  '图片链接',
];

const TEMPLATE_EXAMPLE = [
  ['充电宝 Pro', '数码配件', 'finished_good', '充电宝 Pro 10000mAh', '10000mAh/白色', 199, 89, 0.35, 'EMIE', 'https://example.com/pic1.jpg'],
  ['充电线 Type-C', '数码配件', 'finished_good', 'Type-C 快充线 1m', '1m/黑色', 39, 12, 0.05, 'EMIE', ''],
  ['锂电池 18650', '电池', 'raw_material', '18650 电芯 2600mAh', '2600mAh', null, 8, 0.05, '', ''],
];

function downloadTemplate() {
  const csvContent = [
    TEMPLATE_HEADERS.join(','),
    ...TEMPLATE_EXAMPLE.map((row) =>
      row.map((v) => (v == null ? '' : String(v))).join(','),
    ),
  ].join('\n');

  const blob = new Blob(['﻿' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', '产品导入模板.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ProductImportModal({
  open,
  onClose,
  onSuccess,
}: ProductImportModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleUpload = async (options: any) => {
    const { file, onSuccess: uploadOnSuccess, onError } = options;
    setImporting(true);
    try {
      const res = await importProducts(file);
      setResult(res);
      setCurrentStep(2);
      uploadOnSuccess?.('ok');
      if (res.success > 0) {
        message.success(`成功导入 ${res.success} 条产品`);
      }
      if (res.failed > 0) {
        message.warning(`${res.failed} 条导入失败，请查看错误明细`);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '导入失败');
      onError?.(e);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setFileList([]);
    setResult(null);
    onClose();
  };

  const handleFinish = () => {
    if (result && result.success > 0) {
      onSuccess();
    }
    handleClose();
  };

  const errorColumns = [
    { title: '行号', dataIndex: 'row', width: 80 },
    { title: '错误原因', dataIndex: 'message' },
  ];

  return (
    <Modal
      title="批量导入产品"
      open={open}
      onCancel={handleClose}
      width={720}
      footer={
        currentStep === 2 ? (
          <Space>
            <Button onClick={handleClose}>关闭</Button>
            <Button type="primary" onClick={handleFinish}>
              完成
            </Button>
          </Space>
        ) : (
          <Button onClick={handleClose}>取消</Button>
        )
      }
    >
      <Steps
        current={currentStep}
        items={[
          { title: '下载模板' },
          { title: '上传文件' },
          { title: '导入结果' },
        ]}
        style={{ marginBottom: 24 }}
      />

      {currentStep === 0 && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            message="导入说明"
            description={
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>请先下载导入模板，按模板格式填写产品数据</li>
                <li>产品名称为必填项</li>
                <li>物料类型可选：finished_good（成品）、semi_finished（半成品）、raw_material（原材料）、packaging（包材）</li>
                <li>支持 .xlsx 和 .xls 格式</li>
                <li>首行为表头，数据从第二行开始</li>
              </ul>
            }
            type="info"
            showIcon
          />
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={downloadTemplate}
            >
              下载导入模板
            </Button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button onClick={() => setCurrentStep(1)}>我已准备好，去上传</Button>
          </div>
        </Space>
      )}

      {currentStep === 1 && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ marginBottom: 8 }}>
            <Button
              icon={<DownloadOutlined />}
              onClick={downloadTemplate}
              size="small"
            >
              重新下载模板
            </Button>
          </div>
          <Upload.Dragger
            name="file"
            customRequest={handleUpload}
            fileList={fileList}
            onChange={({ fileList: fl }) => setFileList(fl)}
            accept=".xlsx,.xls"
            maxCount={1}
            showUploadList={false}
            disabled={importing}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
            <p className="ant-upload-hint">
              支持 .xlsx、.xls 格式，单次导入建议不超过 1000 行
            </p>
          </Upload.Dragger>
          {importing && (
            <div style={{ textAlign: 'center', color: '#999' }}>
              正在导入，请稍候...
            </div>
          )}
        </Space>
      )}

      {currentStep === 2 && result && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space size="large" style={{ justifyContent: 'center', width: '100%' }}>
            <Tag
              icon={<CheckCircleOutlined />}
              color="success"
              style={{ fontSize: 16, padding: '4px 12px' }}
            >
              成功：{result.success}
            </Tag>
            <Tag
              icon={<CloseCircleOutlined />}
              color={result.failed > 0 ? 'error' : 'default'}
              style={{ fontSize: 16, padding: '4px 12px' }}
            >
              失败：{result.failed}
            </Tag>
          </Space>

          {result.errors.length > 0 && (
            <>
              <div style={{ fontWeight: 600, marginTop: 16, marginBottom: 8 }}>
                错误明细
              </div>
              <Table
                columns={errorColumns}
                dataSource={result.errors}
                rowKey={(r) => `${r.row}-${r.message}`}
                pagination={{ pageSize: 5, size: 'small' }}
                size="small"
                bordered
              />
            </>
          )}
        </Space>
      )}
    </Modal>
  );
}
