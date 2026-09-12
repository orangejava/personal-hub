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
import AiAuthenticatedMedia from '@/components/ai/AiAuthenticatedMedia';
import type { AiMediaTimePreset } from '@/components/ai/AiMediaListToolbar';

interface AiGenerationStreamProps {
  title: string;
  prompt: string;
  task: AiGenerationTask;
  assets: AiAsset[];
  history?: AiGenerationTask[];
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

function toRecord(task: AiGenerationTask): AiMediaRecord {
  return {
    id: task.id,
    title: task.title,
    prompt: task.prompt,
    task,
    assets: task.assets ?? [],
    createdAt: task.createdAt,
  };
}

/**
 * 图片/视频生成结果流。只展示服务端任务和历史接口返回的数据。
 */
const AiGenerationStream: React.FC<AiGenerationStreamProps> = ({
  title,
  prompt,
  task,
  assets,
  history = [],
  keyword = '',
  timePreset = 'all',
  dateRange,
  visibleCount = 10,
  onEditAgain,
  onRegenerate,
  onUseAsAttachment,
  onViewDetail,
}) => {
  const records = useMemo(() => {
    const current =
      task.id && task.status !== 'idle'
        ? [
            {
              id: task.id,
              title: title || task.title,
              prompt: prompt || task.prompt,
              task: { ...task, assets },
              assets,
              createdAt: task.createdAt,
            },
          ]
        : [];
    const rest = history
      .filter((item) => item.id !== task.id)
      .map(toRecord);
    return [...current, ...rest];
  }, [assets, history, prompt, task, title]);
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
        <Empty description="还没有生成记录。提交提示词后，结果会出现在这里。" />
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
              {record.task.status === 'done'
                ? '生成完成'
                : record.task.status === 'stopped'
                  ? '已停止'
                  : record.task.status === 'failed'
                    ? '失败'
                    : '生成中'}
            </Tag>
            <Tag>{record.task.modelId}</Tag>
            {record.task.params?.size && <Tag>{record.task.params.size}</Tag>}
            {record.task.params?.count && <Tag>{record.task.params.count} 个结果</Tag>}
            {record.task.params?.style && <Tag>{record.task.params.style}</Tag>}
          </div>

          {record.task.status === 'failed' ? (
            <Alert
              showIcon
              icon={<ExclamationCircleOutlined />}
              title="生成失败"
              description="可以调整参数后重新生成。"
              type="error"
            />
          ) : (
            <div className="ph-ai-output-grid">
              {record.assets.map((asset) => (
                <div
                  className="ph-ai-output-media"
                  key={`${record.id}-${asset.id}`}
                >
                  <AiAuthenticatedMedia asset={asset} />
                  {record.task.toolType === 'video' && (
                    <div className="ph-ai-output-video-badge">视频</div>
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

          {recordIndex === 0 && (
            <Space className="ph-ai-media-message-actions">
              <Button icon={<EditOutlined />} onClick={onEditAgain}>
                再次编辑
              </Button>
              <Button
                icon={<RedoOutlined />}
                type="primary"
                onClick={onRegenerate}
              >
                重新生成
              </Button>
            </Space>
          )}
        </article>
      ))}
    </div>
  );
};

export default AiGenerationStream;
