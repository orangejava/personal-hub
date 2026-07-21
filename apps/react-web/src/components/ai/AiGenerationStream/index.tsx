import {
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  PaperClipOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import { Alert, Button, Empty, Space, Tag } from 'antd';
import type { AiAsset, AiGenerationTask } from '@personal-hub/shared-types';
import React, { useMemo } from 'react';
import type { AiMediaTimePreset } from '@/components/ai/AiMediaListToolbar';

interface AiGenerationStreamProps {
  title: string;
  prompt: string;
  task: AiGenerationTask;
  assets: AiAsset[];
  keyword?: string;
  timePreset?: AiMediaTimePreset;
  dateRange?: [string | undefined, string | undefined];
  visibleCount?: number;
  onEditAgain?: () => void;
  onRegenerate?: () => void;
  onUseAsAttachment?: (asset: AiAsset) => void;
  onViewDetail?: (asset: AiAsset) => void;
}

interface AiMediaRecord {
  id: string;
  title: string;
  prompt: string;
  task: AiGenerationTask;
  assets: AiAsset[];
  createdAt: string;
}

const MOCK_HISTORY_DAY_OFFSETS = [
  0,
  1,
  3,
  8,
  16,
  35,
  70,
  110,
  160,
  190,
  220,
  250,
  280,
  310,
  340,
  370,
  400,
  430,
];

function formatMediaTime(input: string) {
  const date = new Date(input);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.floor(
    (startOfToday.getTime() - startOfTarget.getTime()) / 86_400_000,
  );
  const time = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (dayDiff <= 0) return `今天 ${time}`;
  if (dayDiff === 1) return `昨天 ${time}`;
  if (dayDiff <= 7) return '一周前';
  if (dayDiff > 180) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  }
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function getPresetStartDate(preset: AiMediaTimePreset) {
  if (preset === 'all' || preset === 'custom') return undefined;
  const date = new Date();
  const dayCount = preset === 'week' ? 7 : preset === 'month' ? 30 : 90;
  date.setDate(date.getDate() - dayCount);
  return date;
}

function createMockRecords({
  title,
  prompt,
  task,
  assets,
}: {
  title: string;
  prompt: string;
  task: AiGenerationTask;
  assets: AiAsset[];
}) {
  const baseCreatedAt = new Date(task.createdAt || new Date().toISOString());

  return MOCK_HISTORY_DAY_OFFSETS.map((offset, index) => {
    const createdAt = new Date(baseCreatedAt);
    createdAt.setDate(baseCreatedAt.getDate() - offset);
    const isCurrent = index === 0;
    const nextTitle = isCurrent ? title : `${title} · 历史版本 ${index + 1}`;
    const nextPrompt = isCurrent
      ? prompt
      : `${prompt}，历史生成记录 ${index + 1}`;

    return {
      id: `${task.id}-${index}`,
      title: nextTitle,
      prompt: nextPrompt,
      createdAt: createdAt.toISOString(),
      task: {
        ...task,
        id: `${task.id}-${index}`,
        title: nextTitle,
        prompt: nextPrompt,
        createdAt: createdAt.toISOString(),
      },
      assets,
    };
  });
}

function matchKeyword(record: AiMediaRecord, keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return true;
  const paramsText = Object.values(record.task.params ?? {}).join(' ');
  return [
    record.title,
    record.prompt,
    record.task.modelId,
    paramsText,
    ...record.assets.map((asset) => asset.title),
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

function matchTimeFilter(
  record: AiMediaRecord,
  preset: AiMediaTimePreset,
  dateRange?: [string | undefined, string | undefined],
) {
  const createdAt = new Date(record.task.createdAt || record.assets[0]?.createdAt);
  const presetStart = getPresetStartDate(preset);
  const customStart = dateRange?.[0] ? new Date(dateRange[0]) : undefined;
  const customEnd = dateRange?.[1] ? new Date(dateRange[1]) : undefined;

  if (presetStart && createdAt < presetStart) return false;
  if (preset === 'custom') {
    if (customStart && createdAt < customStart) return false;
    if (customEnd && createdAt > customEnd) return false;
  }
  return true;
}

/**
 * 图片/视频生成的连续消息流。
 *
 * 阶段 5.5 先用前端 mock 记录模拟历史分页；后续接真实历史接口时，
 * 可以把 records 的来源换成服务端分页结果，保留当前展示组件。
 */
const AiGenerationStream: React.FC<AiGenerationStreamProps> = ({
  title,
  prompt,
  task,
  assets,
  keyword = '',
  timePreset = 'all',
  dateRange,
  visibleCount = 10,
  onEditAgain,
  onRegenerate,
  onUseAsAttachment,
  onViewDetail,
}) => {
  const records = useMemo(
    () =>
      createMockRecords({
        title,
        prompt,
        task,
        assets,
      }),
    [assets, prompt, task, title],
  );
  const visibleRecords = useMemo(
    () =>
      records
        .filter((record) => matchKeyword(record, keyword))
        .filter((record) => matchTimeFilter(record, timePreset, dateRange))
        .slice(0, visibleCount),
    [dateRange, keyword, records, timePreset, visibleCount],
  );

  if (visibleRecords.length === 0) {
    return (
      <div className="ph-ai-generation-stream ph-ai-generation-stream-empty">
        <Empty description="没有匹配的生成记录，换个关键词或时间范围试试。" />
      </div>
    );
  }

  return (
    <div className="ph-ai-generation-stream">
      {visibleRecords.map((record, recordIndex) => (
        <article className="ph-ai-media-message" key={record.id}>
          <time className="ph-ai-media-message-time">
            {formatMediaTime(record.createdAt)}
          </time>
          <div className="ph-ai-media-message-head">
            <div className="ph-ai-media-message-copy">
              <strong>{record.title}</strong>
              <p>{record.prompt}</p>
            </div>
          </div>
          <div className="ph-ai-media-meta">
            <Tag color={record.task.status === 'done' ? 'green' : 'processing'}>
              {record.task.status === 'done' ? '生成完成' : '生成中'}
            </Tag>
            <Tag>{record.task.modelId}</Tag>
            {record.task.params?.size && <Tag>{record.task.params.size}</Tag>}
            {record.task.params?.count && <Tag>{record.task.params.count} 个结果</Tag>}
            {record.task.params?.durationSeconds && (
              <Tag>{record.task.params.durationSeconds} 秒</Tag>
            )}
            {record.task.params?.style && <Tag>{record.task.params.style}</Tag>}
          </div>

          {record.task.status === 'failed' ? (
            <Alert
              showIcon
              icon={<ExclamationCircleOutlined />}
              title="生成失败"
              description="本次 mock 任务已进入失败态，参数和附件仍保留，可以再次编辑或重新生成。"
              type="error"
            />
          ) : (
            <div className="ph-ai-output-grid">
              {record.assets.map((asset) => (
                <div
                  className="ph-ai-output-media"
                  key={`${record.id}-${asset.id}`}
                >
                  {asset.thumbnailUrl && (
                    <img alt={asset.title} src={asset.thumbnailUrl} />
                  )}
                  {record.task.toolType === 'video' && (
                    <div className="ph-ai-output-video-badge">Mock Video</div>
                  )}
                  <div className="ph-ai-output-actions ph-ai-output-actions-top">
                    <Button
                      icon={<PaperClipOutlined />}
                      size="small"
                      title="引用为附件"
                      onClick={() => onUseAsAttachment?.(asset)}
                    />
                    <Button
                      icon={<EyeOutlined />}
                      size="small"
                      title="查看详情"
                      onClick={() => onViewDetail?.(asset)}
                    />
                  </div>
                  <div className="ph-ai-output-actions ph-ai-output-actions-bottom">
                    <Button
                      href={asset.fileUrl}
                      icon={<DownloadOutlined />}
                      size="small"
                      target="_blank"
                      title="下载"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Space className="ph-ai-media-message-actions">
            <Button icon={<EditOutlined />} onClick={onEditAgain}>
              再次编辑
            </Button>
            <Button
              icon={<RedoOutlined />}
              type={recordIndex === 0 ? 'primary' : 'default'}
              onClick={onRegenerate}
            >
              重新生成
            </Button>
          </Space>
        </article>
      ))}
    </div>
  );
};

export default AiGenerationStream;
