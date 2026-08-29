/**
 * 工作区 model：工作区筛选与编辑草稿状态（内存态）
 */
import { useCallback, useState } from 'react';

export interface WorkspaceFilter {
  keyword?: string;
  type?: string;
  status?: string;
  visibility?: string;
}

export default function WorkspaceModel() {
  const [filter, setFilter] = useState<WorkspaceFilter>({});
  /** 当前正在编辑的草稿内容，key 为内容 id 或 'new' */
  const [drafts, setDrafts] = useState<
    Record<string, { title: string; body: string }>
  >({});

  const updateFilter = useCallback((patch: Partial<WorkspaceFilter>) => {
    setFilter((f) => ({ ...f, ...patch }));
  }, []);

  const saveDraft = useCallback(
    (id: string, draft: { title: string; body: string }) => {
      setDrafts((d) => ({ ...d, [id]: draft }));
    },
    [],
  );

  const getDraft = useCallback((id: string) => drafts[id], [drafts]);

  return { filter, setFilter, updateFilter, drafts, saveDraft, getDraft };
}
