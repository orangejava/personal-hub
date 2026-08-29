/**
 * 系统配置 model：缓存公开系统配置，供未走 initialState 的组件读取
 */

import type { SystemPublicConfig } from '@personal-hub/shared-types';
import { useCallback, useState } from 'react';
import { fetchPublicConfig } from '@/services/system';

export default function SystemModel() {
  const [config, setConfig] = useState<SystemPublicConfig | null>(null);
  const [loading, setLoading] = useState(false);

  /** 拉取公开系统配置 */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPublicConfig();
      if (res?.code === 0) setConfig(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  return { config, setConfig, loading, load };
}
