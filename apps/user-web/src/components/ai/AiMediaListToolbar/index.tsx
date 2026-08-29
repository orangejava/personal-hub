import {
  CloseCircleFilled,
  DownOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, DatePicker, Divider, Input, Popover, Space } from 'antd';
import type { Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';

type AiMediaTimePreset = 'all' | 'week' | 'month' | 'quarter' | 'custom';

interface AiMediaListToolbarProps {
  keyword: string;
  timePreset: AiMediaTimePreset;
  dateRange?: [string | undefined, string | undefined];
  onKeywordChange: (keyword: string) => void;
  onTimePresetChange: (preset: AiMediaTimePreset) => void;
  onDateRangeChange?: (range: [string | undefined, string | undefined]) => void;
}

const timePresetLabels: Record<AiMediaTimePreset, string> = {
  all: '全部',
  week: '最近一周',
  month: '最近一个月',
  quarter: '最近三个月',
  custom: '自定义',
};

const presetOptions: { label: string; value: AiMediaTimePreset }[] = [
  { label: '全部', value: 'all' },
  { label: '最近一周', value: 'week' },
  { label: '最近一个月', value: 'month' },
  { label: '最近三个月', value: 'quarter' },
];

const { RangePicker } = DatePicker;

/**
 * 图片 / 视频消息列表右侧筛选工具。
 *
 * 搜索输入先落到本地草稿，回车或失焦后再提交，避免用户每输入一个字就刷新列表。
 */
const AiMediaListToolbar: React.FC<AiMediaListToolbarProps> = ({
  keyword,
  timePreset,
  onKeywordChange,
  onTimePresetChange,
  onDateRangeChange,
}) => {
  const [searchOpen, setSearchOpen] = useState(Boolean(keyword));
  const [draftKeyword, setDraftKeyword] = useState(keyword);
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);

  useEffect(() => {
    setDraftKeyword(keyword);
    if (keyword) {
      setSearchOpen(true);
    }
  }, [keyword]);

  const commitKeyword = () => {
    onKeywordChange(draftKeyword.trim());
  };

  const timeContent = (
    <div className="ph-ai-media-filter-popover">
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <RangePicker
          className="ph-ai-media-filter-range"
          placeholder={['开始时间', '结束时间']}
          value={[startDate, endDate]}
          onChange={(dates) => {
            const [nextStart, nextEnd] = dates ?? [null, null];
            setStartDate(nextStart);
            setEndDate(nextEnd);
            onTimePresetChange('custom');
            onDateRangeChange?.([
              nextStart?.toISOString(),
              nextEnd?.toISOString(),
            ]);
          }}
        />
        <div className="ph-ai-media-filter-presets">
          {presetOptions.map((option) => (
            <button
              className={[
                'ph-ai-media-filter-preset',
                timePreset === option.value
                  ? 'ph-ai-media-filter-preset-active'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={option.value}
              type="button"
              onClick={() => {
                onTimePresetChange(option.value);
                setStartDate(null);
                setEndDate(null);
                onDateRangeChange?.([undefined, undefined]);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Space>
    </div>
  );

  const timeLabel = useMemo(
    () => timePresetLabels[timePreset] ?? '全部',
    [timePreset],
  );

  return (
    <div className="ph-ai-media-toolbar">
      <div
        className={[
          'ph-ai-media-search',
          searchOpen ? 'ph-ai-media-search-open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {searchOpen ? (
          <Input
            allowClear={{
              clearIcon: <CloseCircleFilled />,
            }}
            autoFocus
            placeholder="搜索 prompt / 模型 / 参数"
            size="small"
            value={draftKeyword}
            onBlur={() => {
              commitKeyword();
              if (!draftKeyword.trim()) {
                setSearchOpen(false);
              }
            }}
            onChange={(event) => setDraftKeyword(event.target.value)}
            onPressEnter={commitKeyword}
          />
        ) : (
          <Button
            aria-label="搜索生成记录"
            icon={<SearchOutlined />}
            size="small"
            type="text"
            onClick={() => setSearchOpen(true)}
          />
        )}
      </div>
      <Divider orientation="vertical" />
      <Popover
        arrow={false}
        content={timeContent}
        placement="bottomRight"
        trigger="click"
      >
        <Button size="small" type="text">
          {timeLabel}
          <DownOutlined />
        </Button>
      </Popover>
    </div>
  );
};

export default AiMediaListToolbar;
export type { AiMediaTimePreset };
