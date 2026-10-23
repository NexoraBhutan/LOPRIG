"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";

interface Page<T> {
  count: number;
  next: string | null;
  results: T[];
}

interface State<T> {
  path: string;
  items: T[];
  count: number;
  next: string | null;
  error: string;
}

/** A DRF paginated list with "load more". Changing `path` (e.g. filters) starts over. */
export function usePagedList<T>(path: string) {
  const [state, setState] = useState<State<T> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<Page<T>>(path)
      .then((page) => !cancelled && setState({ path, items: page.results, count: page.count, next: page.next, error: "" }))
      .catch((err) => !cancelled && setState({ path, items: [], count: 0, next: null, error: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const loadMore = useCallback(async () => {
    if (!state?.next) return;
    setLoadingMore(true);
    try {
      const page = await api<Page<T>>(state.next);
      setState((s) => s && { ...s, items: [...s.items, ...page.results], next: page.next });
    } finally {
      setLoadingMore(false);
    }
  }, [state?.next]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const current = state?.path === path ? state : null;

  return {
    items: current?.items ?? [],
    count: current?.count ?? 0,
    hasMore: Boolean(current?.next),
    loading: !current,
    loadingMore,
    error: current?.error ?? "",
    loadMore,
    reload,
    /** Replace one row in place after an edit, without refetching. */
    update: (match: (item: T) => boolean, next: T) =>
      setState((s) => s && { ...s, items: s.items.map((item) => (match(item) ? next : item)) }),
  };
}
