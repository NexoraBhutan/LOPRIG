import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import CourseCard from "../components/CourseCard";
import FilterSidebar, { applyFilters, DEFAULT_FILTERS } from "../components/FilterSidebar";
import EmptyState from "../components/EmptyState";
import { courses } from "../data/courses";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

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
    <main className="overflow-x-hidden w-full max-w-full">

      <section className="min-h-[50dvh] flex items-end px-8 lg:px-16 pt-36 pb-16 bg-white aw-gold-wash">
        <div className="max-w-[1280px] mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="aw-hero-h1 font-display text-ink-strong w-full max-w-5xl mb-2" style={{ fontSize: "clamp(2.2rem,4vw,3.8rem)" }}>&ldquo;{params.get("q")}&rdquo;</h1>
            <p className="text-ink-muted text-lg">{results.length} course{results.length !== 1 ? "s" : ""} found</p>
          </motion.div>
        </div>
      </section>

      <section className="pb-40 px-8 lg:px-16 bg-white">
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
                title="Can't find what you're looking for?"
                description="Try a different keyword, or browse our full course catalog instead."
                ctaLabel="Browse all courses"
                ctaTo="/courses"
                ctaOutlined
              />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
