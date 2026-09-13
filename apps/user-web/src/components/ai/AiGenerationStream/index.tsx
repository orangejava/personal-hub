import {
  CopyOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  PaperClipOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import { Alert, Button, Empty, Space } from 'antd';
import type { AiAsset, AiGenerationTask } from '@personal-hub/shared-types';
import React, { useMemo } from 'react';
import AiAuthenticatedMedia from '@/components/ai/AiAuthenticatedMedia';
import AiMediaHoverActions from '@/components/ai/AiMediaHoverActions';
import type { AiMediaTimePreset } from '@/components/ai/AiMediaListToolbar';
import AiMediaPromptConfig from '@/components/ai/AiMediaPromptConfig';
import { downloadAiAsset } from '@/services/ai';

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
  modelNames?: Record<string, string>;
  onEditAgain?: (task: AiGenerationTask) => void;
  onRegenerate?: (task: AiGenerationTask) => void;
  onUseAsAttachment?: (asset: AiAsset) => void;
  onViewDetail?: (asset: AiAsset, siblings?: AiAsset[], task?: AiGenerationTask) => void;
  onCopyPrompt?: (prompt: string) => void;
}

interface AiMediaRecord {
  id: string;
  title: string;
  prompt: string;
  task: AiGenerationTask;
  assets: AiAsset[];
  createdAt: string;
}

function resolveMediaDayDiff(input: string) {
  const date = new Date(input);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(
    (startOfToday.getTime() - startOfTarget.getTime()) / 86_400_000,
  );
}

/** 和展示文案同一套分段：今天 / 昨天 / 一周前 / 具体日期，用来决定要不要画分隔线。 */
function resolveMediaTimeBucket(input: string) {
  const date = new Date(input);
  const dayDiff = resolveMediaDayDiff(input);
  if (dayDiff <= 0) return 'today';
  if (dayDiff === 1) return 'yesterday';
  if (dayDiff <= 7) return 'week';
  if (dayDiff > 180) return `${date.getFullYear()}-${date.getMonth()}`;
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatMediaTime(input: string) {
  const date = new Date(input);
  const dayDiff = resolveMediaDayDiff(input);
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
    record.task.modelName,
    paramsText,
    ...record.assets.map((asset) => asset.title),
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalized);
}

function startOfLocalDay(input: Date) {
  return new Date(input.getFullYear(), input.getMonth(), input.getDate());
}

function endOfLocalDay(input: Date) {
  return new Date(input.getFullYear(), input.getMonth(), input.getDate(), 23, 59, 59, 999);
}

function matchTimeFilter(
  record: AiMediaRecord,
  preset: AiMediaTimePreset,
  dateRange?: [string | undefined, string | undefined],
) {
  const createdAt = new Date(record.task.createdAt || record.assets[0]?.createdAt);
  const presetStart = getPresetStartDate(preset);
  const customStart = dateRange?.[0] ? startOfLocalDay(new Date(dateRange[0])) : undefined;
  const customEnd = dateRange?.[1] ? endOfLocalDay(new Date(dateRange[1])) : undefined;

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
  modelNames,
  onEditAgain,
  onRegenerate,
  onUseAsAttachment,
  onViewDetail,
  onCopyPrompt,
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
    return [...current, ...rest].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
  }, [assets, history, prompt, task, title]);
  const visibleRecords = useMemo(() => {
    const matched = records
      .filter((record) => matchKeyword(record, keyword))
      .filter((record) => matchTimeFilter(record, timePreset, dateRange));
    // 聊天式：上面是更早的记录，下面是刚生成的；分页从最新往回取。
    return matched.slice(Math.max(0, matched.length - visibleCount));
  }, [dateRange, keyword, records, timePreset, visibleCount]);

  if (visibleRecords.length === 0) {
    return (
      <div className="ph-ai-generation-stream ph-ai-generation-stream-empty">
        <Empty description="还没有生成记录。提交提示词后，结果会出现在这里。" />
      </div>
    );
  }

  return (
    <div className="ph-ai-generation-stream">
      {visibleRecords.map((record, index) => {
        const next = visibleRecords[index + 1];
        const splitBeforeNext =
          Boolean(next) &&
          resolveMediaTimeBucket(record.createdAt) !==
            resolveMediaTimeBucket(next.createdAt);
        return (
        <article
          className={[
            'ph-ai-media-message',
            splitBeforeNext ? 'ph-ai-media-message-split' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          key={record.id}
        >
          <time className="ph-ai-media-message-time">
            {formatMediaTime(record.createdAt)}
          </time>
          <div className="ph-ai-media-message-head">
            <div className="ph-ai-media-prompt-block">
              <p className="ph-ai-media-prompt-line">
                <span className="ph-ai-media-prompt-text">
                  {record.prompt || record.title}
                </span>
                <span className="ph-ai-media-prompt-swap">
                  <AiMediaPromptConfig
                    modelNames={modelNames}
                    task={record.task}
                  />
                  <span className="ph-ai-media-prompt-actions">
                    <Button
                      aria-label="复制提示词到输入框"
                      icon={<CopyOutlined />}
                      size="small"
                      type="text"
                      onClick={() => onCopyPrompt?.(record.prompt || record.title)}
                    >
                      复制
                    </Button>
                  </span>
                </span>
              </p>
            </div>
          </div>

          {record.task.status === 'failed' ? (
            <Alert
              showIcon
              icon={<ExclamationCircleOutlined />}
              className="ph-ai-output-status"
              title="生成失败"
              description="可以调整参数后重新生成。"
              type="error"
            />
          ) : record.assets.length > 0 ? (
            <div className="ph-ai-output-grid">
              {record.assets.map((asset) => (
                <div
                  className="ph-ai-output-media"
                  key={`${record.id}-${asset.id}`}
                >
                  <AiAuthenticatedMedia asset={asset} controls={false} />
                  {record.task.toolType === 'video' && (
                    <div className="ph-ai-output-video-badge">视频</div>
                  )}
                  <AiMediaHoverActions
                    bottom={[
                      {
                        key: 'download',
                        icon: <DownloadOutlined />,
                        title: '下载',
                        onClick: () => {
                          void downloadAiAsset(asset);
                        },
                      },
                    ]}
                    top={[
                      {
                        key: 'attach',
                        icon: <PaperClipOutlined />,
                        title: '引用为附件',
                        onClick: () => onUseAsAttachment?.(asset),
                      },
                      {
                        key: 'detail',
                        icon: <EyeOutlined />,
                        title: '查看详情',
                        onClick: () => onViewDetail?.(asset, record.assets, record.task),
                      },
                    ]}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Alert
              showIcon
              className="ph-ai-output-status"
              title={
                record.task.status === 'stopped' ? '已停止' : '正在生成'
              }
              description={
                record.task.status === 'stopped'
                  ? '这次没有产出结果，可以重新生成。'
                  : '结果会显示在这里。'
              }
              type={record.task.status === 'stopped' ? 'warning' : 'info'}
            />
          )}

          <Space className="ph-ai-media-message-actions">
            <Button
              icon={<EditOutlined />}
              onClick={() => onEditAgain?.(record.task)}
            >
              再次编辑
            </Button>
            <Button
              icon={<RedoOutlined />}
              onClick={() => onRegenerate?.(record.task)}
            >
              重新生成
            </Button>
          </Space>
        </article>
        );
      })}
    </div>
  );
};

export default AiGenerationStream;
