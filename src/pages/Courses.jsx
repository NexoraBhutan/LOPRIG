import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FaSlidersH, FaTimes } from "react-icons/fa";
import CourseCard from "../components/CourseCard";
import FilterSidebar, { applyFilters, DEFAULT_FILTERS } from "../components/FilterSidebar";
import Mascot from "../components/Mascot";
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

export default function Courses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => paramsToFilters(searchParams));
  const [sort, setSort] = useState(searchParams.get("sort") || "popular");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    const params = filtersToParams(filters);
    if (sort !== "popular") params.set("sort", sort);
    setSearchParams(params, { replace: true });
  }, [filters, sort, setSearchParams]);

  const results = useMemo(() => applyFilters(courses, filters, sort), [filters, sort]);

  return (
    <div className="page-enter container listing-page">
      <div className="listing-head">
        <div>
          <span className="eyebrow">Marketplace</span>
          <h1 className="section-title">Explore Courses</h1>
          <p className="section-sub">{courses.length} courses across programming, business, design, languages, and more.</p>
        </div>
        <div className="listing-controls">
          <button className="btn btn-outline btn-sm mobile-filter-toggle" onClick={() => setMobileFiltersOpen(true)}>
            <FaSlidersH size={14} /> Filters
          </button>
          <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort courses">
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      <div className="listing-body">
        <div className="listing-sidebar-desktop">
          <FilterSidebar filters={filters} setFilters={setFilters} resultCount={results.length} />
        </div>

        <div className="listing-results">
          {results.length ? (
            <div className="course-grid">
              {results.map((c) => <CourseCard key={c.id} course={c} />)}
            </div>
          ) : (
            <div className="empty-state">
              <Mascot pose="sad" size={100} />
              <h3>No courses match your filters</h3>
              <p>Try adjusting your filters to see more results.</p>
              <button className="btn btn-outline" onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</button>
            </div>
          )}
        </div>
      </div>

      {mobileFiltersOpen && (
        <div className="mobile-filter-drawer">
          <div className="mobile-filter-drawer-head">
            <h3>Filters</h3>
            <button onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters"><FaTimes size={18} /></button>
          </div>
          <FilterSidebar filters={filters} setFilters={setFilters} resultCount={results.length} />
          <button className="btn btn-primary btn-block" onClick={() => setMobileFiltersOpen(false)}>Show {results.length} results</button>
        </div>
      )}
    </div>
  );
}
