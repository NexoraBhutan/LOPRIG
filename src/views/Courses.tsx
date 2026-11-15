"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { SlidersHorizontal, X } from "@phosphor-icons/react";
import CourseCard from "@/components/CourseCard";
import FilterSidebar, { applyFilters, DEFAULT_FILTERS } from "@/components/FilterSidebar";
import EmptyState from "@/components/EmptyState";
import { useCatalog } from "@/context/CatalogContext";
import type { Filters, SortOption } from "@/types";

import { photo } from "@/lib/photos";
const SORT_LABELS: Record<SortOption, string> = {
  popular: "Most Popular",
  newest: "Newest",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
};

function filtersToParams(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.categories.length) params.set("cat", filters.categories.join(","));
  if (filters.levels.length) params.set("lvl", filters.levels.join(","));
  if (filters.price !== "all") params.set("price", filters.price);
  if (filters.minRating) params.set("rating", String(filters.minRating));
  return params;
}

function paramsToFilters(params: URLSearchParams): Filters {
  return {
    categories: params.get("cat") ? params.get("cat")!.split(",") : [],
    levels: (params.get("lvl") ? params.get("lvl")!.split(",") : []) as Filters["levels"],
    price: params.get("price") || "all",
    minRating: Number(params.get("rating")) || 0,
  };
}

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

export default function Courses() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>(() => paramsToFilters(new URLSearchParams(searchParams?.toString() ?? "")));
  const [sort, setSort] = useState<SortOption>(
    (searchParams?.get("sort") as SortOption | null) || "popular"
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = filtersToParams(filters);
    if (sort !== "popular") params.set("sort", sort);
    const query = params.toString();
    router.replace(query ? `/courses?${query}` : "/courses", { scroll: false });
  }, [filters, sort, router]);

  const { courses, ready } = useCatalog();
  const hasPaid = courses.some((c) => c.discountPrice > 0);
  const results = useMemo(() => applyFilters(courses, filters, sort), [courses, filters, sort]);

  // Focus trap for mobile filter drawer
  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const drawer = drawerRef.current;
    const focusable = drawer?.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])');
    if (focusable?.length) focusable[0].focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMobileFiltersOpen(false); return; }
      if (e.key !== "Tab" || !drawer || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileFiltersOpen]);

  return (
    <main className="overflow-x-hidden w-full max-w-full">

      {/* LISTING HERO — Editorial Split with massive negative space */}
      <section className="px-8 lg:px-16 pt-36 pb-16 bg-white aw-gold-wash overflow-hidden">
        <div className="max-w-[1280px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="aw-hero-h1 font-display text-ink-strong w-full max-w-5xl">
              Explore courses
            </h1>
            <p className="text-ink-muted text-lg max-w-[520px] mt-5">{courses.length} courses across programming, business, design, languages, and more.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="hidden lg:block rounded-3xl overflow-hidden aspect-[4/3] group"
          >
            <img src={photo("catalog")} alt="Learners browsing course materials together" className="w-full h-full object-cover grayscale-[12%] contrast-110 transition-transform duration-700 ease-out group-hover:scale-105" />
          </motion.div>
        </div>

        <div className="max-w-[1280px] mx-auto w-full flex items-center justify-end gap-3 mt-12">
          <button
            className="lg:hidden btn btn-outline-neutral btn-sm"
            onClick={() => setMobileFiltersOpen(true)}
          >
            <SlidersHorizontal size={14} /> Filters
          </button>
          <label className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Sort</span>
            <select
              className="border-2 border-line-strong rounded-[4px] bg-white px-4 py-2.5 text-xs font-bold text-ink-strong appearance-none cursor-pointer hover:border-gold transition-colors"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
            >
            {(Object.keys(SORT_LABELS) as SortOption[])
              .filter((option) => hasPaid || !option.startsWith("price"))
              .map((option) => (
              <option key={option} value={option}>{SORT_LABELS[option]}</option>
            ))}
          </select>
          </label>
        </div>
      </section>

      {/* BODY */}
      <section className="pb-32 md:pb-48 px-8 lg:px-16 bg-white">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10">
          <div className="hidden lg:block">
            <FilterSidebar filters={filters} setFilters={setFilters} resultCount={results.length} />
          </div>

          <div>
            {results.length ? (
              <motion.div
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                variants={stagger}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
              >
                {results.map((c) => (
                  <motion.div key={c.id} variants={fadeUp}>
                    <CourseCard course={c} />
                  </motion.div>
                ))}
              </motion.div>
            ) : ready && (
              <EmptyState
                pose="sad"
                title="No courses match your filters"
                description="Try adjusting your filters to see more results."
                ctaLabel="Clear filters"
                ctaOutlined
                ctaOnClick={() => setFilters(DEFAULT_FILTERS)}
              />
            )}
          </div>
        </div>
      </section>

      {/* MOBILE FILTER DRAWER — with focus trap */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
          <div ref={drawerRef} className="absolute right-0 top-0 bottom-0 w-[320px] bg-white p-6 overflow-y-auto flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink-strong">Filters</h3>
              <button onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters" className="btn-icon" style={{ width: '2.25rem', height: '2.25rem' }}>
                <X size={16} weight="bold" />
              </button>
            </div>
            <FilterSidebar filters={filters} setFilters={setFilters} resultCount={results.length} />
            <button
              className="btn btn-primary btn-block"
              onClick={() => setMobileFiltersOpen(false)}
            >
              Show {results.length} results
            </button>
          </div>
        </div>
      )}
    </main>
  );
}