import { useState } from 'react';
import { Upload, message, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';

interface MultiImageUploadProps {
  value?: string[];
  onChange?: (urls: string[]) => void;
  maxCount?: number;
  readonly?: boolean;
  onUpload?: (files: File[]) => Promise<string[]>;
  onDelete?: (index: number) => Promise<void>;
}

export default function MultiImageUpload({
  value = [],
  onChange,
  maxCount = 9,
  readonly = false,
  onUpload,
  onDelete,
}: MultiImageUploadProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [uploading, setUploading] = useState(false);

  const urls = value || [];

  const handleCustomUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    if (!onUpload) {
      // 如果没有提供 onUpload，则使用 URL 模式（直接返回 URL）
      const url = URL.createObjectURL(file);
      const newUrls = [...urls, url];
      onChange?.(newUrls);
      onSuccess?.('ok');
      return;
    }

    setUploading(true);
    try {
      const newUrls = await onUpload([file]);
      onChange?.(newUrls);
      onSuccess?.('ok');
    } catch (e: any) {
      message.error(e?.response?.data?.message || '上传失败');
      onError?.(e);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (index: number) => {
    if (readonly) return;

    if (onDelete) {
      try {
        await onDelete(index);
        const newUrls = urls.filter((_, i) => i !== index);
        onChange?.(newUrls);
      } catch (e: any) {
        message.error(e?.response?.data?.message || '删除失败');
      }
    } else {
      const newUrls = urls.filter((_, i) => i !== index);
      onChange?.(newUrls);
    }
  };

  const handlePreview = (url: string) => {
    setPreviewImage(url);
    setPreviewOpen(true);
  };

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 80px)',
          gap: 8,
        }}
      >
        {urls.map((url, index) => (
          <div
            key={`${url}-${index}`}
            style={{
              width: 80,
              height: 80,
              position: 'relative',
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid #d9d9d9',
            }}
          >
            <img
              src={url}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              referrerPolicy="no-referrer"
            />
            {!readonly && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  cursor: 'pointer',
                }}
                className="image-overlay"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '0';
                }}
              >
                <EyeOutlined
                  style={{ color: '#fff', fontSize: 16 }}
                  onClick={() => handlePreview(url)}
                />
                <DeleteOutlined
                  style={{ color: '#ff4d4f', fontSize: 16 }}
                  onClick={() => handleRemove(index)}
                />
              </div>
            )}
            {/* 纯 CSS hover 备用方案 */}
            <style>{`
              .image-overlay:hover {
                opacity: 1 !important;
              }
            `}</style>
          </div>
        ))}

        {!readonly && urls.length < maxCount && (
          <Upload
            customRequest={handleCustomUpload}
            showUploadList={false}
            accept="image/*"
            disabled={uploading}
          >
            <div
              style={{
                width: 80,
                height: 80,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px dashed #d9d9d9',
                borderRadius: 8,
                cursor: 'pointer',
                background: '#fafafa',
                color: '#999',
              }}
            >
              <PlusOutlined style={{ fontSize: 20 }} />
              <span style={{ fontSize: 12, marginTop: 4 }}>上传</span>
            </div>
          </Upload>
        )}
      </div>

      <Modal
        open={previewOpen}
        footer={null}
        onCancel={() => setPreviewOpen(false)}
        centered
        width={600}
      >
        <img
          src={previewImage}
          alt=""
          style={{ width: '100%', borderRadius: 8 }}
          referrerPolicy="no-referrer"
        />
      </Modal>
    </div>
  );
}
