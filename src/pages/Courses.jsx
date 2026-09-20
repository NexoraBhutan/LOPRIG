import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { SlidersHorizontal, X } from "@phosphor-icons/react";
import CourseCard from "../components/CourseCard";
import FilterSidebar, { applyFilters, DEFAULT_FILTERS } from "../components/FilterSidebar";
import EmptyState from "../components/EmptyState";
import { courses } from "../data/courses";

function filtersToParams(filters) {
  const params = new URLSearchParams();
  if (filters.categories.length) params.set("cat", filters.categories.join(","));
  if (filters.levels.length) params.set("lvl", filters.levels.join(","));
  if (filters.price !== "all") params.set("price", filters.price);
  if (filters.minRating) params.set("rating", String(filters.minRating));
  return params;
}

function paramsToFilters(params) {
  return {
    categories: params.get("cat") ? params.get("cat").split(",") : [],
    levels: params.get("lvl") ? params.get("lvl").split(",") : [],
    price: params.get("price") || "all",
    minRating: Number(params.get("rating")) || 0,
  };
}

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

export default function Courses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => paramsToFilters(searchParams));
  const [sort, setSort] = useState(searchParams.get("sort") || "popular");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const drawerRef = useRef(null);

  useEffect(() => {
    const params = filtersToParams(filters);
    if (sort !== "popular") params.set("sort", sort);
    setSearchParams(params, { replace: true });
  }, [filters, sort, setSearchParams]);

  const results = useMemo(() => applyFilters(courses, filters, sort), [filters, sort]);

  // Focus trap for mobile filter drawer
  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const drawer = drawerRef.current;
    const focusable = drawer?.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
    if (focusable?.length) focusable[0].focus();

    const onKeyDown = (e) => {
      if (e.key === "Escape") { setMobileFiltersOpen(false); return; }
      if (e.key !== "Tab" || !drawer) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileFiltersOpen]);

  const closeDrawer = useCallback(() => setMobileFiltersOpen(false), []);

  return (
    <main className="overflow-x-hidden w-full max-w-full">

      {/* LISTING HERO */}
      <section className="min-h-[52dvh] flex items-end px-8 lg:px-16 pt-36 pb-16 bg-white aw-gold-wash">
        <div className="max-w-[1280px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 items-end">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="aw-hero-h1 font-display text-ink-strong w-full max-w-5xl mb-4">
              Explore courses
            </h1>
            <p className="text-ink-muted text-lg max-w-[560px]">{courses.length} courses across programming, business, design, languages, and more.</p>
          </motion.div>

          <div className="flex items-center gap-3">
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
                onChange={(e) => setSort(e.target.value)}
              >
              <option value="popular">Most Popular</option>
              <option value="rating">Highest Rated</option>
              <option value="newest">Newest</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
            </label>
          </div>
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
            ) : (
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
          <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} />
          <div ref={drawerRef} className="absolute right-0 top-0 bottom-0 w-[320px] bg-white p-6 overflow-y-auto flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink-strong">Filters</h3>
              <button onClick={closeDrawer} aria-label="Close filters" className="btn-icon" style={{ width: '2.25rem', height: '2.25rem' }}>
                <X size={16} weight="bold" />
              </button>
            </div>
            <FilterSidebar filters={filters} setFilters={setFilters} resultCount={results.length} />
            <button
              className="btn btn-primary btn-block"
              onClick={closeDrawer}
            >
              Show {results.length} results
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
