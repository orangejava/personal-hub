import type { AiGenerationTask, AiToolType } from '@personal-hub/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { useRequest } from '@/hooks/useRequest';
import { resolveMediaHistoryLoadMore } from '@/components/ai/mediaHistory';
import { fetchAiGenerationJobs } from '@/services/ai';

/**
 * 图/视频历史：本地先露出一部分，滚到顶再加；不够时翻页追加，不再写死 18 条。
 */
export function useAiMediaJobHistory(
  toolType: Extract<AiToolType, 'image' | 'video'>,
) {
  const [page, setPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(10);
  const [historyTasks, setHistoryTasks] = useState<AiGenerationTask[]>([]);
  const { data: jobsPage, loading } = useRequest(
    () => fetchAiGenerationJobs({ toolType, page, pageSize: 20 }),
    { refreshDeps: [page, toolType] },
  );

  useEffect(() => {
    const list = jobsPage?.list ?? [];
    setHistoryTasks((current) => {
      if (page <= 1) return list;
      const seen = new Set(current.map((item) => item.id));
      return [...current, ...list.filter((item) => !seen.has(item.id))];
    });
  }, [jobsPage?.list, page]);

  const total = jobsPage?.total ?? historyTasks.length;

  const loadMore = useCallback(() => {
    setVisibleCount((count) => {
      const { nextVisible, shouldFetchNextPage } = resolveMediaHistoryLoadMore({
        visibleCount: count,
        loadedCount: historyTasks.length,
        total,
      });
      if (shouldFetchNextPage) {
        setPage((current) => current + 1);
      }
      return nextVisible;
    });
  }, [historyTasks.length, total]);

  const resetVisible = useCallback(() => {
    setVisibleCount(10);
  }, []);

  return {
    historyTasks,
    loading: loading && page <= 1,
    visibleCount,
    loadMore,
    resetVisible,
  };
}
