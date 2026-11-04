"use client";

import { Star } from "@phosphor-icons/react";
import type { Course, CourseLevel, Filters } from "@/types";
import { useCatalog } from "@/context/CatalogContext";

const LEVELS: readonly CourseLevel[] = ["Beginner", "Intermediate", "All Levels"];
const PRICES = [
  { id: "all", label: "All prices" },
  { id: "under500", label: "Under Nu. 500" },
  { id: "500-1000", label: "Nu. 500 - 1,000" },
  { id: "over1000", label: "Over Nu. 1,000" },
] as const;
const RATINGS = [4.5, 4.0, 3.5] as const;

export default function FilterSidebar({
  filters,
  setFilters,
  resultCount,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  resultCount?: number | null;
}) {
  const { categories, courses } = useCatalog();
  // While payments are off every course is free, so a price filter would only confuse.
  const hasPaid = courses.some((c) => c.discountPrice > 0);
  const toggleCategory = (id: string) => {
    setFilters((f) => ({
      ...f,
      categories: f.categories.includes(id) ? f.categories.filter((c) => c !== id) : [...f.categories, id],
    }));
  };
  const toggleLevel = (lvl: CourseLevel) => {
    setFilters((f) => ({
      ...f,
      levels: f.levels.includes(lvl) ? f.levels.filter((l) => l !== lvl) : [...f.levels, lvl],
    }));
  };

  const clearAll = () =>
    setFilters({ categories: [], levels: [], price: "all", minRating: 0 });

  return (
    <aside className="bg-white border-2 border-line rounded-xl p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink-strong">Filters</h3>
        <button className="text-xs font-bold text-gold-dark hover:text-gold transition-colors bg-transparent border-none cursor-pointer" onClick={clearAll}>Clear all</button>
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="text-xs font-bold text-ink-strong uppercase tracking-wider">Category</h4>
        {categories.map((cat) => (
          <label key={cat.id} className="flex items-center gap-2.5 text-sm text-ink cursor-pointer hover:text-gold-dark transition-colors">
            <input
              type="checkbox"
              checked={filters.categories.includes(cat.id)}
              onChange={() => toggleCategory(cat.id)}
              className="w-4 h-4 accent-gold rounded"
            />
            <span>{cat.title}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="text-xs font-bold text-ink-strong uppercase tracking-wider">Level</h4>
        {LEVELS.map((lvl) => (
          <label key={lvl} className="flex items-center gap-2.5 text-sm text-ink cursor-pointer hover:text-gold-dark transition-colors">
            <input
              type="checkbox"
              checked={filters.levels.includes(lvl)}
              onChange={() => toggleLevel(lvl)}
              className="w-4 h-4 accent-gold rounded"
            />
            <span>{lvl}</span>
          </label>
        ))}
      </div>

      {hasPaid && <div className="flex flex-col gap-3">
        <h4 className="text-xs font-bold text-ink-strong uppercase tracking-wider">Price</h4>
        {PRICES.map((p) => (
          <label key={p.id} className="flex items-center gap-2.5 text-sm text-ink cursor-pointer hover:text-gold-dark transition-colors">
            <input
              type="radio"
              name="price"
              checked={filters.price === p.id}
              onChange={() => setFilters((f) => ({ ...f, price: p.id }))}
              className="w-4 h-4 accent-gold"
            />
            <span>{p.label}</span>
          </label>
        ))}
      </div>}

      <div className="flex flex-col gap-3">
        <h4 className="text-xs font-bold text-ink-strong uppercase tracking-wider">Rating</h4>
        {RATINGS.map((r) => (
          <label key={r} className="flex items-center gap-2.5 text-sm text-ink cursor-pointer hover:text-gold-dark transition-colors">
            <input
              type="radio"
              name="rating"
              checked={filters.minRating === r}
              onChange={() => setFilters((f) => ({ ...f, minRating: r }))}
              className="w-4 h-4 accent-gold"
            />
            <span className="inline-flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={12} weight={i <= Math.round(r) ? "fill" : "regular"} className="text-gold" />
              ))}
            </span>
            <span>{r}+ &amp; up</span>
          </label>
        ))}
        <label className="flex items-center gap-2.5 text-sm text-ink cursor-pointer hover:text-gold-dark transition-colors">
          <input type="radio" name="rating" checked={filters.minRating === 0} onChange={() => setFilters((f) => ({ ...f, minRating: 0 }))} className="w-4 h-4 accent-gold" />
          <span>Any rating</span>
        </label>
      </div>

      {resultCount != null && (
        <p className="text-xs text-ink-muted border-t border-line pt-4">{resultCount} course{resultCount !== 1 ? "s" : ""} found</p>
      )}
    </aside>
  );
}

export function applyFilters(list: Course[], filters: Filters, sort: string): Course[] {
  let result = list.filter((c) => {
    if (filters.categories.length && !filters.categories.includes(c.category)) return false;
    if (filters.levels.length && !filters.levels.includes(c.level)) return false;
    if (filters.minRating && c.rating < filters.minRating) return false;
    if (filters.price === "under500" && c.discountPrice >= 500) return false;
    if (filters.price === "500-1000" && (c.discountPrice < 500 || c.discountPrice > 1000)) return false;
    if (filters.price === "over1000" && c.discountPrice <= 1000) return false;
    return true;
  });

  switch (sort) {
    case "rating":
      result = [...result].sort((a, b) => b.rating - a.rating);
      break;
    case "newest":
      result = [...result].reverse();
      break;
    case "price-asc":
      result = [...result].sort((a, b) => a.discountPrice - b.discountPrice);
      break;
    case "price-desc":
      result = [...result].sort((a, b) => b.discountPrice - a.discountPrice);
      break;
    default:
      result = [...result].sort((a, b) => b.students - a.students);
  }
  return result;
}

export const DEFAULT_FILTERS: Filters = { categories: [], levels: [], price: "all", minRating: 0 };