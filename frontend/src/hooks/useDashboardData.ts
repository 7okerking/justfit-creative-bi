import { useCallback, useEffect, useState } from "react";
import { fetchMeta, refreshData } from "../api/client";
import type { GlobalFilters, MetaResponse } from "../types";

/** 全局元数据与刷新逻辑 */
export function useMeta() {
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMeta();
      setMeta(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const res = await refreshData();
    await load();
    return res;
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  return { meta, loading, error, reload: load, refresh };
}

/** 通用异步数据拉取 Hook */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[]
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

export type { GlobalFilters };
