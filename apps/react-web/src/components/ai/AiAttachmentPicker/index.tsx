import {
  FileImageOutlined,
  FileTextOutlined,
  PlaySquareOutlined,
} from '@ant-design/icons';
import { Button, Drawer, Empty, Space, Tag } from 'antd';
import React, { useMemo, useState } from 'react';

export interface AiAttachmentItem {
  id: string;
  name: string;
  typeLabel: string;
  sizeLabel: string;
}

interface AiAttachmentPickerProps {
  selectedIds: string[];
  onSelect: (item: AiAttachmentItem) => void;
}

const mockAttachments: AiAttachmentItem[] = [
  {
    id: 'mock-attachment-cover',
    name: '知识文章封面参考图.png',
    typeLabel: '图片',
    sizeLabel: '1.2 MB',
  },
  {
    id: 'mock-attachment-outline',
    name: '阶段 5 PRD 摘要.md',
    typeLabel: '文档',
    sizeLabel: '18 KB',
  },
  {
    id: 'mock-attachment-demo-video',
    name: '产品介绍短片参考.mp4',
    typeLabel: '视频',
    sizeLabel: '8.4 MB',
  },
];

function getAttachmentIcon(typeLabel: string) {
  if (typeLabel === '图片') return <FileImageOutlined />;
  if (typeLabel === '视频') return <PlaySquareOutlined />;
  return <FileTextOutlined />;
}

/**
 * AI mock 附件选择器。
 *
 * 阶段 5 先用内置样例模拟“上传附件”后的选择与引用，不读取本地文件；
 * 后续接真实上传时，可在此组件内替换为 `AiXAttachments` 或后端上传接口。
 */
const AiAttachmentPicker: React.FC<AiAttachmentPickerProps> = ({
  selectedIds,
  onSelect,
}) => {
  const [open, setOpen] = useState(false);
  const availableAttachments = useMemo(() => mockAttachments, []);

  return (
    <>
      <Button size="small" onClick={() => setOpen(true)}>
        上传附件
      </Button>
      <Drawer
        destroyOnHidden
        open={open}
        size="default"
        title="选择 mock 附件"
        onClose={() => setOpen(false)}
      >
        {availableAttachments.length > 0 ? (
          <div className="ph-ai-attachment-picker-list">
            {availableAttachments.map((item) => {
              const selected = selectedIds.includes(item.id);
              return (
                <div className="ph-ai-attachment-picker-item" key={item.id}>
                  <div className="ph-ai-attachment-picker-icon">
                    {getAttachmentIcon(item.typeLabel)}
                  </div>
                  <div className="ph-ai-attachment-picker-content">
                    <Space wrap>
                      <span>{item.name}</span>
                      <Tag>{item.typeLabel}</Tag>
                    </Space>
                    <div className="ph-ai-attachment-picker-meta">
                      {item.sizeLabel} · 阶段 5 mock 附件
                    </div>
                  </div>
                  <Button
                    disabled={selected}
                    size="small"
                    type={selected ? 'default' : 'primary'}
                    onClick={() => {
                      onSelect(item);
                      setOpen(false);
                    }}
                  >
                    {selected ? '已添加' : '添加'}
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty description="暂无可用附件" />
        )}
      </Drawer>
    </>
  );
};

export default AiAttachmentPicker;
