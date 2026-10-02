import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Image, Space, Upload, message } from 'antd';
import React, { useState } from 'react';
import { uploadCoverImage } from '@/services/files';

interface ImageFileFieldProps {
  value: string[];
  previewUrls?: Record<string, string>;
  maxCount: number;
  disabled?: boolean;
  onChange: (nextValue: string[]) => void;
}

/**
 * 后台系统配置的图片字段。
 *
 * 图片先完成对象存储直传并通过后端校验，拿到 READY 文件 ID 后才通知父表单保存；
 * 因此配置里不会出现上传中的文件 ID。
 */
const ImageFileField: React.FC<ImageFileFieldProps> = ({
  value,
  previewUrls = {},
  maxCount,
  disabled = false,
  onChange,
}) => {
  const [uploading, setUploading] = useState(false);
  const [localPreviewUrls, setLocalPreviewUrls] = useState<Record<string, string>>({});
  const canUpload = !disabled && !uploading && value.length < maxCount;

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const uploaded = await uploadCoverImage(file);
      const localPreviewUrl = URL.createObjectURL(file);
      setLocalPreviewUrls((current) => ({ ...current, [uploaded.id]: localPreviewUrl }));
      onChange([...value, uploaded.id]);
      message.success('图片已上传，保存配置后将在公开页生效');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '图片上传失败');
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (fileId: string) => {
    const previewUrl = localPreviewUrls[fileId];
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setLocalPreviewUrls((current) => {
        const { [fileId]: _, ...rest } = current;
        return rest;
      });
    }
    onChange(value.filter((id) => id !== fileId));
  };

  return (
    <Space wrap size={12}>
      {value.map((fileId) => {
        const previewUrl = localPreviewUrls[fileId] ?? previewUrls[fileId];
        return (
          <div key={fileId} style={{ width: 132 }}>
            {previewUrl ? (
              <Image
                alt="项目图片预览"
                height={96}
                src={previewUrl}
                style={{ objectFit: 'cover', width: '100%' }}
                width={132}
              />
            ) : (
              <div
                style={{
                  alignItems: 'center',
                  background: '#fafafa',
                  display: 'flex',
                  fontSize: 12,
                  height: 96,
                  overflowWrap: 'anywhere',
                  padding: 8,
                  width: 132,
                }}
              >
                图片链接加载中
              </div>
            )}
            <Button
              block
              danger
              disabled={disabled}
              icon={<DeleteOutlined />}
              size="small"
              style={{ marginTop: 4 }}
              onClick={() => handleRemove(fileId)}
            >
              移除引用
            </Button>
          </div>
        );
      })}
      {canUpload && (
        <Upload
          accept="image/jpeg,image/png,image/webp"
          customRequest={({ file, onError, onSuccess }) => {
            if (!(file instanceof File)) {
              onError?.(new Error('浏览器未提供可上传的图片文件'));
              return;
            }
            handleUpload(file)
              .then(() => onSuccess?.({}))
              .catch((error) =>
                onError?.(error instanceof Error ? error : new Error('图片上传失败')),
              );
          }}
          disabled={disabled}
          maxCount={1}
          showUploadList={false}
        >
          <Button icon={<PlusOutlined />} loading={uploading}>
            上传图片
          </Button>
        </Upload>
      )}
    </Space>
  );
};

export default ImageFileField;
