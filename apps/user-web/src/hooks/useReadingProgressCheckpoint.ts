import { useCallback, useEffect, useRef } from 'react';
import {
  getReadingProgress,
  type LocalReadingProgress,
  setReadingProgress,
  shouldPersistReadingProgress,
} from '@/utils/clientPreferences';

type ReadingProgressSnapshot = Omit<LocalReadingProgress, 'updatedAt'>;

interface UseReadingProgressCheckpointOptions {
  contentId: string;
  enabled: boolean;
  /** 仅在页面离开类事件中写服务端，滚动检查点始终只落本地。 */
  sync?: (progress: LocalReadingProgress) => Promise<void>;
  /** 页面可见时读取实时位置；路由卸载时只使用滚动事件已采集的快照。 */
  readLatest?: () => ReadingProgressSnapshot | undefined;
}

type QueuedSync = {
  progress: LocalReadingProgress;
  sync: (progress: LocalReadingProgress) => Promise<void>;
};

type ContentSyncState = {
  lastSignature?: string;
  inFlight: boolean;
  queued?: QueuedSync;
};

/**
 * 统一阅读进度检查点。每篇内容独立保留快照和同步状态，避免路由切换时串写进度。
 * 滚动事件只更新内存并按距离落本地；隐藏时读取实时位置，卸载时收口已采集快照。
 */
export function useReadingProgressCheckpoint({
  contentId,
  enabled,
  sync,
  readLatest,
}: UseReadingProgressCheckpointOptions) {
  const latestByContentRef = useRef(new Map<string, LocalReadingProgress>());
  const persistedByContentRef = useRef(new Map<string, LocalReadingProgress>());
  const syncStateByContentRef = useRef(new Map<string, ContentSyncState>());
  const syncByContentRef = useRef(
    new Map<string, (progress: LocalReadingProgress) => Promise<void>>(),
  );
  const readerByContentRef = useRef(
    new Map<string, () => ReadingProgressSnapshot | undefined>(),
  );
  const activeContentIdRef = useRef(contentId);

  activeContentIdRef.current = contentId;
  if (sync) syncByContentRef.current.set(contentId, sync);
  else syncByContentRef.current.delete(contentId);
  if (readLatest) readerByContentRef.current.set(contentId, readLatest);
  else readerByContentRef.current.delete(contentId);

  const persistLocal = useCallback(
    (force: boolean, atBoundary = false) => {
      const latest = latestByContentRef.current.get(contentId);
      if (!latest) return false;
      if (
        !force &&
        !shouldPersistReadingProgress(
          persistedByContentRef.current.get(contentId),
          latest,
          window.innerHeight,
          atBoundary,
        )
      ) {
        return false;
      }
      setReadingProgress(contentId, latest);
      persistedByContentRef.current.set(contentId, latest);
      return true;
    },
    [contentId],
  );

  const syncContent = useCallback(
    (
      targetContentId: string,
      progress: LocalReadingProgress,
      syncOverride?: (progress: LocalReadingProgress) => Promise<void>,
    ) => {
      const syncProgress =
        syncOverride ?? syncByContentRef.current.get(targetContentId);
      if (!syncProgress) return;
      const state = syncStateByContentRef.current.get(targetContentId) ?? {
        inFlight: false,
      };
      syncStateByContentRef.current.set(targetContentId, state);
      const signature = `${progress.chapterId ?? ''}:${progress.percent}:${progress.page ?? ''}`;
      if (state.inFlight) {
        state.queued = { progress, sync: syncProgress };
        return;
      }
      if (state.lastSignature === signature) return;

      state.inFlight = true;
      void Promise.resolve()
        .then(() => syncProgress(progress))
        .then(() => {
          state.lastSignature = signature;
        })
        .catch(() => undefined)
        .finally(() => {
          state.inFlight = false;
          const queued = state.queued;
          state.queued = undefined;
          if (queued)
            syncContent(targetContentId, queued.progress, queued.sync);
        });
    },
    [],
  );

  const flushContent = useCallback(
    (targetContentId: string, readDom: boolean) => {
      // pagehide / visibilitychange 可读当前页面；卸载清理只用该内容最后一个内存快照。
      if (readDom && activeContentIdRef.current === targetContentId) {
        const current = readerByContentRef.current.get(targetContentId)?.();
        if (current) {
          latestByContentRef.current.set(targetContentId, {
            ...current,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      const latest = latestByContentRef.current.get(targetContentId);
      if (!latest) return;
      if (targetContentId === contentId) {
        persistLocal(true);
      } else {
        setReadingProgress(targetContentId, latest);
        persistedByContentRef.current.set(targetContentId, latest);
      }
      syncContent(targetContentId, latest);
    },
    [contentId, persistLocal, syncContent],
  );

  const report = useCallback(
    (progress: ReadingProgressSnapshot, options?: { atBoundary?: boolean }) => {
      const latest = { ...progress, updatedAt: new Date().toISOString() };
      latestByContentRef.current.set(contentId, latest);
      if (
        shouldPersistReadingProgress(
          persistedByContentRef.current.get(contentId),
          latest,
          window.innerHeight,
          options?.atBoundary,
        )
      ) {
        persistLocal(false, options?.atBoundary);
      }
    },
    [contentId, persistLocal],
  );

  const flushSnapshot = useCallback(
    () => flushContent(contentId, false),
    [contentId, flushContent],
  );

  const flush = useCallback(
    () => flushContent(contentId, true),
    [contentId, flushContent],
  );

  useEffect(() => {
    if (!enabled) return;
    if (!latestByContentRef.current.has(contentId)) {
      const saved = getReadingProgress(contentId);
      if (saved) {
        latestByContentRef.current.set(contentId, saved);
        persistedByContentRef.current.set(contentId, saved);
      }
    }

    const onPageHide = () => flushContent(contentId, true);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushContent(contentId, true);
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flushContent(contentId, false);
    };
  }, [contentId, enabled, flushContent]);

  return { report, flush, flushSnapshot };
}
