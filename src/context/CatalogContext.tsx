"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Category, Course } from "@/types";
import { api, apiAll, errorMessage } from "@/lib/api";
import { type ApiCategory, type ApiCourse, toCategory, toCourse } from "@/lib/mappers";

interface CatalogContextValue {
  courses: Course[];
  categories: Category[];
  ready: boolean;
  error: string | null;
  getCourse: (id: string) => Course | undefined;
  reload: () => void;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

/**
 * The published catalogue, loaded once per visit. It is small, so listing pages
 * filter and sort it in the browser; the API also supports server-side filters
 * for when the catalogue grows.
 */
export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<ApiCategory[]>("/categories/"), apiAll<ApiCourse>("/courses/")])
      .then(([cats, list]) => {
        if (cancelled) return;
        setCategories(cats.map(toCategory));
        setCourses(list.map(toCourse));
        setError(null);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const getCourse = useCallback((id: string) => courses.find((c) => c.id === id), [courses]);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo(
    () => ({ courses, categories, ready, error, getCourse, reload }),
    [courses, categories, ready, error, getCourse, reload]
  );

  return (
    <CatalogContext.Provider value={value}>
      {error && (
        <div role="alert" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-[calc(100%-2rem)] flex items-center gap-4 bg-ink-strong text-white text-sm px-5 py-3 rounded-xl shadow-elevated">
          <span>{error}</span>
          <button onClick={reload} className="text-gold font-bold bg-transparent border-none cursor-pointer">Retry</button>
        </div>
      )}
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used within CatalogProvider");
  return ctx;
}
