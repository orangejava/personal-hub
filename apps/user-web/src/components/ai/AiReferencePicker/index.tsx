import { SearchOutlined } from '@ant-design/icons';
import { useRequest } from '@/hooks/useRequest';

import { Button, Drawer, Empty, Input, Skeleton, Space, Tag } from 'antd';
import {
  ContentTypeLabel,
  type ContentItem,
} from '@personal-hub/shared-types';
import React, { useMemo, useState } from 'react';
import { fetchContentList } from '@/services/content';

export interface AiReferenceItem {
  id: string;
  title: string;
  typeLabel: string;
  summary?: string;
}

interface AiReferencePickerProps {
  disabled?: boolean;
  selectedIds: string[];
  onSelect: (item: AiReferenceItem) => void;
}

function toReferenceItem(item: ContentItem): AiReferenceItem {
  return {
    id: item.id,
    title: item.title,
    typeLabel: ContentTypeLabel[item.type],
    summary: item.summary,
  };
}

/**
 * AI 内容引用选择器。
 *
 * 阶段 5 先复用内容中心 mock 列表，让 Chat 输入区可以选择知识内容作为上下文；
 * 后续扩展片段选择、多选搜索或权限过滤时，优先在这个组件内收敛交互。
 */
const AiReferencePicker: React.FC<AiReferencePickerProps> = ({
  disabled,
  selectedIds,
  onSelect,
}) => {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const { data, loading } = useRequest(
    () =>
      fetchContentList({
        page: 1,
        pageSize: 8,
        keyword,
        sort: 'latest',
      }),
    {
      ready: open,
      refreshDeps: [keyword, open],
    },
  );
  const items = useMemo(() => data?.list ?? [], [data]);

  return (
    <>
      <Button
        disabled={disabled}
        size="small"
        onClick={() => setOpen(true)}
      >
        引用内容
      </Button>
      <Drawer
        destroyOnHidden
        open={open}
        size="default"
        title="引用知识内容"
        onClose={() => setOpen(false)}
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Input.Search
            allowClear
            enterButton={<SearchOutlined />}
            placeholder="搜索标题、摘要或标签"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={setKeyword}
          />
          {loading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : items.length > 0 ? (
            <div className="ph-ai-reference-picker-list">
              {items.map((item) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <div className="ph-ai-reference-picker-item" key={item.id}>
                    <div className="ph-ai-reference-picker-content">
                      <Space wrap>
                        <span>{item.title}</span>
                        <Tag>{ContentTypeLabel[item.type]}</Tag>
                      </Space>
                      <div className="ph-ai-reference-picker-summary">
                        {item.summary}
                      </div>
                    </div>
                    <Button
                      disabled={selected}
                      size="small"
                      type={selected ? 'default' : 'primary'}
                      onClick={() => {
                        onSelect(toReferenceItem(item));
                        setOpen(false);
                      }}
                    >
                      {selected ? '已引用' : '引用'}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty description="没有找到可引用内容" />
          )}
        </Space>
      </Drawer>
    </>
  );
};

export default AiReferencePicker;
