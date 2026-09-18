import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FaBook, FaCode, FaChartBar, FaCalculator, FaBriefcase, FaPalette, FaBullhorn,
  FaShieldAlt, FaGlobe, FaLanguage, FaRocket,
} from "react-icons/fa";
import CourseCard from "../components/CourseCard";
import FilterSidebar, { applyFilters, DEFAULT_FILTERS } from "../components/FilterSidebar";
import Mascot from "../components/Mascot";
import { categories, courses } from "../data/courses";

// Explicit map (not a wildcard `import * as Icons`) — a namespace import used
// with dynamic property access defeats Rollup's tree-shaking and pulls the
// entire icon library into the bundle. Keep this list in sync with the
// `icon` values in data/courses.js's `categories` array.
const ICONS = {
  Book: FaBook, Code: FaCode, ChartBar: FaChartBar, Calculator: FaCalculator, Briefcase: FaBriefcase,
  Palette: FaPalette, Bullhorn: FaBullhorn, ShieldAlt: FaShieldAlt, Globe: FaGlobe, Language: FaLanguage,
  Rocket: FaRocket,
};

// colorlib's Course template is essentially monochrome (gold on near-black),
// not multi-hue — so category icon badges rotate between the two brand tones
// instead of a rainbow, alternating for scannability without breaking the
// restrained palette.
const ICON_COLORS = [
  { bg: "var(--gold)", fg: "var(--ink-strong)" },
  { bg: "var(--ink-strong)", fg: "#fff" },
];
const iconColorFor = (index) => ICON_COLORS[index % ICON_COLORS.length];

export default function Category() {
  const { id } = useParams();

  // Hooks must run unconditionally on every render — the "no id -> index
  // view" branch has to come after them, not before, or React loses track
  // of hook order the moment a user navigates between /categories and
  // /categories/:id.
  const categoryIndex = categories.findIndex((c) => c.id === id);
  const category = categories[categoryIndex];
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const inCategory = useMemo(() => courses.filter((c) => c.category === id), [id]);
  const results = useMemo(() => applyFilters(inCategory, filters, "popular"), [inCategory, filters]);

  if (!id) return <CategoryIndex />;

  const Icon = category ? ICONS[category.icon] : FaBook;
  const { bg, fg } = iconColorFor(categoryIndex >= 0 ? categoryIndex : 0);

  return (
    <div className="page-enter container listing-page">
      <div className="category-hero">
        <span className="category-hero-icon" style={{ "--icon-bg": bg, "--icon-fg": fg }}>
          <Icon size={24} />
        </span>
        <h1 className="section-title">{category ? category.title : "Category"}</h1>
        <p className="section-sub">{inCategory.length} course{inCategory.length !== 1 ? "s" : ""} in this category.</p>
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
              <h3>No courses yet in this category</h3>
              <p>Check back soon, or explore our full catalog.</p>
              <Link to="/courses" className="btn btn-outline">Browse all courses</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CategoryIndex() {
  return (
    <div className="page-enter container listing-page">
      <div className="category-hero">
        <h1 className="section-title">Browse Categories</h1>
        <p className="section-sub">Choose an area of interest to start exploring courses.</p>
      </div>
      <div className="category-grid">
        {categories.map((cat, i) => {
          const Icon = ICONS[cat.icon];
          const { bg, fg } = iconColorFor(i);
          return (
            <Link to={`/categories/${cat.id}`} key={cat.id} className="category-card card">
              <span className="category-icon" style={{ "--icon-bg": bg, "--icon-fg": fg }}>
                <Icon size={20} />
              </span>
              <div>
                <h3>{cat.title}</h3>
                <span>{cat.count} courses</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
