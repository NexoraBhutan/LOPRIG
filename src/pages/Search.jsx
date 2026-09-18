import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CourseCard from "../components/CourseCard";
import FilterSidebar, { applyFilters, DEFAULT_FILTERS } from "../components/FilterSidebar";
import Mascot from "../components/Mascot";
import { courses } from "../data/courses";

export default function Search() {
  const [params] = useSearchParams();
  const q = (params.get("q") || "").trim().toLowerCase();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const matched = useMemo(() => {
    if (!q) return [];
    return courses.filter((c) =>
      [c.title, c.description, c.category, c.instructor.name].join(" ").toLowerCase().includes(q)
    );
  }, [q]);

  const results = useMemo(() => applyFilters(matched, filters, "popular"), [matched, filters]);

  return (
    <div className="page-enter container listing-page">
      <div className="search-head">
        <h1>Search results for "{params.get("q")}"</h1>
        <p className="search-meta">{results.length} course{results.length !== 1 ? "s" : ""} found</p>
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
              <h3>Can't find what you're looking for?</h3>
              <p>Try a different keyword, or browse our full course catalog instead.</p>
              <a href="/courses" className="btn btn-outline">Browse all courses</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
