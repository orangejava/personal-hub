import { useEffect, useState } from 'react';
import { subscribePerf } from '@/utils/perf/store';

/** 样本写入后加一，让打开中的抽屉和面板重新读本机数据。 */
export function usePerfRevision(): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => subscribePerf(() => setRevision((value) => value + 1)), []);

  return revision;
}
