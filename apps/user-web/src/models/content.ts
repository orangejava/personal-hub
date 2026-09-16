/**
 * 内容 model：筛选偏好与最近阅读记录（内存态）
 */
import { useCallback, useState } from 'react';

export interface ContentFilter {
  keyword?: string;
  type?: string;
  category?: string;
  tag?: string;
  sort?: 'latest' | 'views';
}

export default function ContentModel() {
  const [filter, setFilter] = useState<ContentFilter>({ sort: 'latest' });
  const [recentReading, setRecentReading] = useState<
    { contentId: string; percent: number }[]
  >([]);

  const updateFilter = useCallback((patch: Partial<ContentFilter>) => {
    setFilter((f) => ({ ...f, ...patch }));
  }, []);

  const recordReading = useCallback((contentId: string, percent: number) => {
    setRecentReading((list) => {
      const rest = list.filter((r) => r.contentId !== contentId);
      return [{ contentId, percent }, ...rest].slice(0, 10);
    });
  }, []);

  return { filter, setFilter, updateFilter, recentReading, recordReading };
}
