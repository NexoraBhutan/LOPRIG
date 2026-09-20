import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Book, Code, ChartBar, Calculator, Briefcase, Palette, Megaphone,
  Shield, Globe, Rocket,
} from "@phosphor-icons/react";
import CourseCard from "../components/CourseCard";
import FilterSidebar, { applyFilters, DEFAULT_FILTERS } from "../components/FilterSidebar";
import EmptyState from "../components/EmptyState";
import { categories, courses } from "../data/courses";

const ICONS = {
  Code, ChartBar, Calculator, Briefcase, Palette, Bullhorn: Megaphone,
  ShieldAlt: Shield, Globe, Language: Globe, Rocket, Book,
};

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

function CategoryIndex() {
  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <section className="min-h-[50dvh] flex items-end px-8 lg:px-16 pt-36 pb-16 bg-white aw-gold-wash">
        <div className="max-w-[1280px] mx-auto w-full">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            <h1 className="aw-hero-h1 font-display text-ink-strong w-full max-w-5xl mb-2" style={{ fontSize: "clamp(2.2rem,4vw,3.8rem)" }}>Browse Categories</h1>
            <p className="text-ink-muted text-lg">Choose an area of interest to start exploring courses.</p>
          </motion.div>
        </div>
      </section>

      <section className="pb-40 px-8 lg:px-16 bg-white">
        <div className="max-w-[1280px] mx-auto">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
          >
            {categories.map((cat, i) => {
              const Icon = ICONS[cat.icon] || Book;
              const isGold = i % 2 === 0;
              return (
                <motion.div key={cat.id} variants={fadeUp}>
                  <Link to={`/categories/${cat.id}`} className="flex items-center gap-4 p-6 bg-white border-2 border-line rounded-xl hover:border-gold hover:shadow-[0_8px_32px_rgba(255,182,6,0.1)] transition-all duration-300 hover:-translate-y-1 no-underline">
                    <span className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isGold ? "bg-gold text-ink-strong" : "bg-ink-strong text-white"}`}>
                      <Icon size={20} weight="duotone" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-ink-strong">{cat.title}</h3>
                      <span className="text-xs text-ink-muted">{cat.count} courses</span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>
    </main>
  );
}

export default function Category() {
  const { id } = useParams();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const inCategory = useMemo(() => courses.filter((c) => c.category === id), [id]);
  const results = useMemo(() => applyFilters(inCategory, filters, "popular"), [inCategory, filters]);

  if (!id) return <CategoryIndex />;

  const category = categories.find((c) => c.id === id);
  const Icon = category ? (ICONS[category.icon] || Book) : Book;
  const catIndex = categories.findIndex((c) => c.id === id);
  const isGold = catIndex % 2 === 0;

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <section className="min-h-[50dvh] flex items-end px-8 lg:px-16 pt-32 pb-20 bg-white">
        <div className="max-w-[1280px] mx-auto w-full">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            <span className={`inline-flex items-center justify-center w-14 h-14 rounded-xl mb-6 ${isGold ? "bg-gold text-ink-strong" : "bg-ink-strong text-white"}`}>
              <Icon size={24} weight="duotone" />
            </span>
            <h1 className="text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong mb-2">{category ? category.title : "Category"}</h1>
            <p className="text-ink-muted text-lg">{inCategory.length} course{inCategory.length !== 1 ? "s" : ""} in this category.</p>
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
                title="No courses yet in this category"
                description="Check back soon, or explore our full catalog."
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
