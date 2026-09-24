import {
  AudioOutlined,
  ClearOutlined,
  MoreOutlined,
  PauseCircleOutlined,
  SendOutlined,
  ThunderboltOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { Button, Drawer, Input, Select, Space, Tooltip } from 'antd';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import viewportBands from '@/config/viewport-bands.json';
import {
  AiComposerMoreActionContext,
  AiComposerMoreSurfaceContext,
} from './moreActionContext';

interface AiComposerModel {
  value?: string;
  options: { label: React.ReactNode; value: string; disabled?: boolean }[];
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onChange: (modelId: string) => void;
}

interface AiComposerProps {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  submitDisabled?: boolean;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  model?: AiComposerModel;
  /** 会改变底栏内容宽度的稳定键；变化后重新探测是否仍需要紧凑模式。 */
  layoutKey?: React.Key;
  /** 窄屏优先留在底栏的入口，例如配置或高级设置。放不下时才收进更多。 */
  pinnedLeading?: React.ReactNode;
  leadingActions?: React.ReactNode;
  extraActions?: React.ReactNode;
  attachments?: React.ReactNode;
  references?: React.ReactNode;
  footerExtra?: React.ReactNode;
  submitLabel?: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop?: () => void;
  onClear?: () => void;
  onVoice?: () => void;
  onOptimize?: (value: string) => string | Promise<string>;
}

const DEFAULT_MIN_HEIGHT = 72;
const DEFAULT_HEIGHT = 88;
const DEFAULT_MAX_HEIGHT = 200;

function isPhoneWidth(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia(`(max-width: ${viewportBands.phoneMax}px)`).matches
  );
}

/** 底栏自己会被内容撑开，要用更窄的祖先宽度判断是否已经超出可视区域。 */
function visibleWidth(element: HTMLElement): number {
  let width = element.clientWidth;
  let node = element.parentElement;
  while (node && node !== document.body) {
    if (node.clientWidth > 0 && node.clientWidth < width) width = node.clientWidth;
    node = node.parentElement;
  }
  return width;
}

/**
 * AI 创作输入框。
 *
 * 组件只管理输入区交互和按钮编排，附件、引用内容、模型列表等业务状态由页面传入。
 * 手机整档使用紧凑底栏；更宽的档若按最小尺寸仍放不下，也收成同一套，而不是把按钮挤窄。
 */
const AiComposer: React.FC<AiComposerProps> = ({
  value,
  placeholder,
  disabled,
  loading,
  submitDisabled,
  defaultHeight,
  minHeight = DEFAULT_MIN_HEIGHT,
  maxHeight = DEFAULT_MAX_HEIGHT,
  model,
  layoutKey,
  pinnedLeading,
  leadingActions,
  extraActions,
  attachments,
  references,
  footerExtra,
  submitLabel = '发送',
  onChange,
  onSubmit,
  onStop,
  onClear,
  onVoice,
  onOptimize,
}) => {
  const footerRef = useRef<HTMLDivElement>(null);
  const fullWidthNeeded = useRef(0);
  /** 等「更多」退出动画结束后再执行，避免和二级浮层叠在同一帧。 */
  const pendingNestedOpenRef = useRef<(() => void) | undefined>(undefined);
  /** 收起配置时的可见宽度。变宽超过一截再展开，避免测量来回 setState。 */
  const widthWhenPinnedHidden = useRef(0);
  const compactInitial = isPhoneWidth();
  const compactRef = useRef(compactInitial);
  const hidePinnedRef = useRef(false);
  const [compact, setCompactState] = useState(compactInitial);
  const [hidePinned, setHidePinnedState] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [optimizeSnapshot, setOptimizeSnapshot] = useState<string>();
  const [optimizing, setOptimizing] = useState(false);
  const undoVisible = optimizeSnapshot !== undefined;
  const previousLayoutStateRef = useRef({ layoutKey, undoVisible });
  const canSubmit = Boolean(value.trim()) && !disabled && !submitDisabled && !loading;

  const setCompact = useCallback((nextCompact: boolean) => {
    compactRef.current = nextCompact;
    setCompactState((current) => (current === nextCompact ? current : nextCompact));
  }, []);

  const setHidePinned = useCallback((nextHidePinned: boolean) => {
    hidePinnedRef.current = nextHidePinned;
    setHidePinnedState((current) => (current === nextHidePinned ? current : nextHidePinned));
  }, []);

  const submit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit(value);
  }, [canSubmit, onSubmit, value]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      event.preventDefault();
      submit();
    },
    [submit],
  );

  const handleOptimize = useCallback(async () => {
    if (!onOptimize || !value.trim()) return;
    setOptimizeSnapshot(value);
    setOptimizing(true);
    try {
      const nextValue = await onOptimize(value);
      onChange(nextValue);
    } finally {
      setOptimizing(false);
    }
  }, [onChange, onOptimize, value]);

  const measureFooter = useCallback(() => {
    const footer = footerRef.current;
    if (!footer || typeof window === 'undefined') return;
    const phoneQuery = window.matchMedia(`(max-width: ${viewportBands.phoneMax}px)`);
    const visible = visibleWidth(footer);
    const left = footer.querySelector('.ph-ai-composer-left');
    const leftOverflow =
      left instanceof HTMLElement
        ? Math.max(0, left.scrollWidth - left.clientWidth)
        : 0;
    const overflows = footer.scrollWidth > visible + 8 || leftOverflow > 8;
    const currentCompact = compactRef.current;
    const currentHidePinned = hidePinnedRef.current;

    if (phoneQuery.matches) {
      // 先完成模式切换，再用紧凑 DOM 复测是否还需要把固定入口收进更多。
      if (!currentCompact) {
        setCompact(true);
        return;
      }
      if (!currentHidePinned && overflows) {
        widthWhenPinnedHidden.current = visible;
        setHidePinned(true);
      } else if (
        currentHidePinned &&
        !overflows &&
        visible > widthWhenPinnedHidden.current + 48
      ) {
        setHidePinned(false);
      }
      return;
    }

    if (currentCompact && fullWidthNeeded.current === 0) {
      setCompact(false);
      if (currentHidePinned) setHidePinned(false);
      return;
    }

    if (!currentCompact) {
      if (overflows) {
        // 记录“当前可见宽度 + 溢出余量 + 缓冲”，避免普通/紧凑模式在临界宽度来回抖动。
        fullWidthNeeded.current = Math.max(
          fullWidthNeeded.current,
          visible + leftOverflow + 48,
          footer.scrollWidth + 48,
        );
        setCompact(true);
      }
      return;
    }

    if (fullWidthNeeded.current > 0 && visible >= fullWidthNeeded.current) {
      setCompact(false);
      if (currentHidePinned) setHidePinned(false);
      return;
    }

    if (!currentHidePinned && overflows) {
      widthWhenPinnedHidden.current = visible;
      setHidePinned(true);
    } else if (
      currentHidePinned &&
      !overflows &&
      visible > widthWhenPinnedHidden.current + 48
    ) {
      setHidePinned(false);
    }
  }, [setCompact, setHidePinned]);

  useLayoutEffect(() => {
    const previous = previousLayoutStateRef.current;
    if (Object.is(previous.layoutKey, layoutKey) && previous.undoVisible === undoVisible) return;
    previousLayoutStateRef.current = { layoutKey, undoVisible };
    fullWidthNeeded.current = 0;
    widthWhenPinnedHidden.current = 0;
    if (!isPhoneWidth()) {
      setHidePinned(false);
      setCompact(false);
    }
  }, [layoutKey, setCompact, setHidePinned, undoVisible]);

  // React 子节点的文案或动作集合变化只会改变 scrollWidth，不一定触发 ResizeObserver。
  useLayoutEffect(() => {
    measureFooter();
  });

  useLayoutEffect(() => {
    const footer = footerRef.current;
    if (!footer || typeof window === 'undefined') return;
    const phoneQuery = window.matchMedia(`(max-width: ${viewportBands.phoneMax}px)`);

    const observer = new ResizeObserver(measureFooter);
    observer.observe(footer);
    phoneQuery.addEventListener('change', measureFooter);
    return () => {
      observer.disconnect();
      phoneQuery.removeEventListener('change', measureFooter);
    };
  }, [measureFooter]);

  useEffect(() => {
    if (compact) return;
    pendingNestedOpenRef.current = undefined;
    setMoreOpen(false);
  }, [compact]);

  const showPinned = Boolean(pinnedLeading) && !(compact && hidePinned);
  const modelWidth = compact ? viewportBands.modelPhoneMin : viewportBands.modelDesktop;

  const closeMore = () => setMoreOpen(false);

  /**
   * 先关掉底部「更多」，等它的退出动画结束再打开二级浮层。
   * 这样 Drawer / Modal 不会与外层面板的退出动画叠在同一帧。
   */
  const openNestedPanel = useCallback(
    (openPanel: () => void) => {
      if (!moreOpen) {
        openPanel();
        return;
      }
      pendingNestedOpenRef.current = openPanel;
      setMoreOpen(false);
    },
    [moreOpen],
  );

  const handleMoreAfterOpenChange = (nextOpen: boolean) => {
    if (nextOpen || !pendingNestedOpenRef.current) return;
    const openPanel = pendingNestedOpenRef.current;
    pendingNestedOpenRef.current = undefined;
    openPanel();
  };

  const handleClear = () => {
    onClear?.();
    closeMore();
  };

  const overflowActions = (
    <>
      {hidePinned ? pinnedLeading : null}
      {leadingActions}
      {extraActions}
      {footerExtra}
      {onOptimize && (
        <Button
          disabled={!value.trim() || disabled}
          icon={<ThunderboltOutlined />}
          loading={optimizing}
          onClick={() => {
            void handleOptimize();
            closeMore();
          }}
        >
          优化
        </Button>
      )}
      {optimizeSnapshot !== undefined && (
        <Button
          icon={<UndoOutlined />}
          onClick={() => {
            onChange(optimizeSnapshot);
            setOptimizeSnapshot(undefined);
            closeMore();
          }}
        >
          撤销优化
        </Button>
      )}
      <Button
        icon={<AudioOutlined />}
        onClick={() => {
          onVoice?.();
          closeMore();
        }}
      >
        语音
      </Button>
      <Button disabled={!value && !onClear} icon={<ClearOutlined />} onClick={handleClear}>
        清空
      </Button>
    </>
  );

  return (
    <div className={compact ? 'ph-ai-composer ph-ai-composer-compact' : 'ph-ai-composer'}>
      {(references || attachments) && (
        <div className="ph-ai-composer-context">
          {references}
          {attachments}
        </div>
      )}
      <Input.TextArea
        className="ph-ai-composer-input"
        disabled={disabled}
        placeholder={placeholder}
        style={{ height: defaultHeight ?? DEFAULT_HEIGHT, minHeight, maxHeight }}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="ph-ai-composer-footer" ref={footerRef}>
        {/* 先保持单行，才能让测量逻辑发现桌面窄档的真实溢出并切换到「更多」。 */}
        <Space className="ph-ai-composer-left" size={8} wrap={false}>
          {model && (
            <Select
              className="ph-ai-composer-model"
              disabled={model.disabled}
              loading={model.loading}
              options={model.options}
              placeholder={model.placeholder ?? '选择模型'}
              popupMatchSelectWidth={240}
              size="small"
              style={{ width: modelWidth }}
              value={model.value}
              onChange={model.onChange}
            />
          )}
          {showPinned ? pinnedLeading : null}
          {!compact && leadingActions}
          {!compact && footerExtra}
        </Space>
        <Space className="ph-ai-composer-right" size={6}>
          {!compact && extraActions}
          {!compact && onOptimize && (
            <Tooltip title="优化提示词">
              <Button
                disabled={!value.trim() || disabled}
                icon={<ThunderboltOutlined />}
                loading={optimizing}
                size="small"
                type="text"
                onClick={handleOptimize}
              />
            </Tooltip>
          )}
          {!compact && optimizeSnapshot !== undefined && (
            <Tooltip title="撤销优化">
              <Button
                icon={<UndoOutlined />}
                size="small"
                type="text"
                onClick={() => {
                  onChange(optimizeSnapshot);
                  setOptimizeSnapshot(undefined);
                }}
              />
            </Tooltip>
          )}
          {!compact && (
            <Tooltip title="语音输入（占位）">
              <Button icon={<AudioOutlined />} size="small" type="text" onClick={onVoice} />
            </Tooltip>
          )}
          {!compact && (
            <Tooltip title="清空输入">
              <Button
                disabled={!value && !onClear}
                icon={<ClearOutlined />}
                size="small"
                type="text"
                onClick={onClear}
              />
            </Tooltip>
          )}
          {compact && (
            <Button icon={<MoreOutlined />} type="text" onClick={() => setMoreOpen(true)}>
              更多
            </Button>
          )}
          {loading ? (
            <Tooltip title="停止生成">
              <Button
                icon={<PauseCircleOutlined />}
                shape="circle"
                type="primary"
                onClick={onStop}
              />
            </Tooltip>
          ) : (
            <Tooltip title={submitLabel}>
              <Button
                disabled={!canSubmit}
                icon={<SendOutlined />}
                shape="circle"
                type="primary"
                onClick={submit}
              />
            </Tooltip>
          )}
        </Space>
      </div>
      <Drawer
        afterOpenChange={handleMoreAfterOpenChange}
        open={compact && moreOpen}
        placement="bottom"
        // 嵌套 Drawer 默认会把父面板推开 180px。底部抽屉被这下推完，看起来就像从底部升到页面中间。
        push={false}
        size="auto"
        title="更多"
        onClose={() => setMoreOpen(false)}
      >
        <AiComposerMoreActionContext.Provider value={openNestedPanel}>
          <AiComposerMoreSurfaceContext.Provider value>
            {compact ? (
              <div className="ph-booklet-mobile-action-grid ph-ai-composer-more-grid">
                {overflowActions}
              </div>
            ) : null}
          </AiComposerMoreSurfaceContext.Provider>
        </AiComposerMoreActionContext.Provider>
      </Drawer>
    </div>
  );
};

export default AiComposer;
export type { AiComposerProps };
