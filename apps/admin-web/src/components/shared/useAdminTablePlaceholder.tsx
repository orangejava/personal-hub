import type { SpinProps } from 'antd';
import React, { useRef, useState } from 'react';
import ResultState from './ResultState';
import SectionSkeleton from './SectionSkeleton';

function isTableSpinning(loading: boolean | SpinProps | undefined) {
  if (typeof loading === 'boolean') return loading;
  if (loading && typeof loading === 'object') return loading.spinning !== false;
  return false;
}

/**
 * 后台表格第一次加载用行骨架占住表格高度。
 * 请求失败时给出可见的失败说明；已经有数据后再刷新，仍用表格自己的加载层。
 */
export function useAdminTablePlaceholder(emptyDescription: string) {
  const [loading, setLoading] = useState(true);
  const [hasRows, setHasRows] = useState(false);
  const [failed, setFailed] = useState(false);
  const sawSpin = useRef(false);
  const loaded = useRef(false);

  return {
    onLoadingChange: (next: boolean | SpinProps | undefined) => {
      const spinning = isTableSpinning(next);
      setLoading(spinning);
      if (spinning) {
        sawSpin.current = true;
        setFailed(false);
        return;
      }
      if (sawSpin.current && !loaded.current) setFailed(true);
    },
    onLoad: (rows: readonly unknown[]) => {
      loaded.current = true;
      setFailed(false);
      setHasRows(rows.length > 0);
    },
    ...(hasRows ? {} : { loading: false as const }),
    locale: {
      emptyText: loading ? (
        <SectionSkeleton variant="table" rows={10} />
      ) : failed ? (
        <ResultState status="error" title="列表加载失败" description="可以稍后重试" />
      ) : (
        <ResultState status="empty" description={emptyDescription} />
      ),
    },
  };
}
