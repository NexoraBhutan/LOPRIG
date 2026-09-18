import { FaStar, FaRegStar } from "react-icons/fa";
import { categories } from "../data/courses";

const LEVELS = ["Beginner", "Intermediate", "All Levels"];
const PRICES = [
  { id: "all", label: "All prices" },
  { id: "under500", label: "Under Nu. 500" },
  { id: "500-1000", label: "Nu. 500 – 1,000" },
  { id: "over1000", label: "Over Nu. 1,000" },
];
const RATINGS = [4.5, 4.0, 3.5];

export default function FilterSidebar({ filters, setFilters, resultCount }) {
  const toggleCategory = (id) => {
    setFilters((f) => ({
      ...f,
      categories: f.categories.includes(id) ? f.categories.filter((c) => c !== id) : [...f.categories, id],
    }));
  };
  const toggleLevel = (lvl) => {
    setFilters((f) => ({
      ...f,
      levels: f.levels.includes(lvl) ? f.levels.filter((l) => l !== lvl) : [...f.levels, lvl],
    }));
  };

  const clearAll = () =>
    setFilters({ categories: [], levels: [], price: "all", minRating: 0 });

  return (
    <aside className="filter-sidebar card-plain">
      <div className="filter-sidebar-head">
        <h3>Filters</h3>
        <button className="filter-clear" onClick={clearAll}>Clear all</button>
      </div>

      <div className="filter-group">
        <h4>Category</h4>
        {categories.map((cat) => (
          <label className="filter-check" key={cat.id}>
            <input type="checkbox" checked={filters.categories.includes(cat.id)} onChange={() => toggleCategory(cat.id)} />
            <span>{cat.title}</span>
          </label>
        ))}
      </div>

      <div className="filter-group">
        <h4>Level</h4>
        {LEVELS.map((lvl) => (
          <label className="filter-check" key={lvl}>
            <input type="checkbox" checked={filters.levels.includes(lvl)} onChange={() => toggleLevel(lvl)} />
            <span>{lvl}</span>
          </label>
        ))}
      </div>

      <div className="filter-group">
        <h4>Price</h4>
        {PRICES.map((p) => (
          <label className="filter-radio" key={p.id}>
            <input
              type="radio"
              name="price"
              checked={filters.price === p.id}
              onChange={() => setFilters((f) => ({ ...f, price: p.id }))}
            />
            <span>{p.label}</span>
          </label>
        ))}
      </div>

      <div className="filter-group">
        <h4>Rating</h4>
        {RATINGS.map((r) => (
          <label className="filter-radio" key={r}>
            <input
              type="radio"
              name="rating"
              checked={filters.minRating === r}
              onChange={() => setFilters((f) => ({ ...f, minRating: r }))}
            />
            <span className="filter-stars">
              {[1, 2, 3, 4, 5].map((i) =>
                i <= Math.round(r)
                  ? <FaStar key={i} size={14} color="var(--gold)" />
                  : <FaRegStar key={i} size={14} color="var(--gold)" />
              )}
            </span>
            <span>{r}+ &amp; up</span>
          </label>
        ))}
        <label className="filter-radio">
          <input type="radio" name="rating" checked={filters.minRating === 0} onChange={() => setFilters((f) => ({ ...f, minRating: 0 }))} />
          <span>Any rating</span>
        </label>
      </div>

      {resultCount != null && <p className="filter-count">{resultCount} course{resultCount !== 1 ? "s" : ""} found</p>}
    </aside>
  );
}

export function applyFilters(list, filters, sort) {
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

export const DEFAULT_FILTERS = { categories: [], levels: [], price: "all", minRating: 0 };
