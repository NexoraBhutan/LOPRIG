"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Book, Code, ChartBar, Calculator, Briefcase, Palette, Megaphone,
  Shield, Globe, Rocket,
} from "@phosphor-icons/react";
import CourseCard from "@/components/CourseCard";
import FilterSidebar, { applyFilters, DEFAULT_FILTERS } from "@/components/FilterSidebar";
import EmptyState from "@/components/EmptyState";
import PageLoader from "@/components/PageLoader";
import { useCatalog } from "@/context/CatalogContext";
import type { IconName } from "@/types";

const ICONS: Record<string, typeof Code> = {
  Code, ChartBar, Calculator, Briefcase, Palette, Bullhorn: Megaphone,
  ShieldAlt: Shield, Globe, Language: Globe, Rocket, Book,
};

export function categoryIcon(name: IconName) {
  return ICONS[name] || Code;
}

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

export function CategoryIndex() {
  const { categories } = useCatalog();
  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <section className="px-8 lg:px-16 pt-36 pb-16 bg-white aw-gold-wash">
        <div className="max-w-[1280px] mx-auto w-full">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            <h1 className="aw-hero-h1 font-display text-ink-strong w-full max-w-5xl" style={{ fontSize: "clamp(2.2rem,4vw,3.8rem)" }}>Browse categories</h1>
            <p className="text-ink-muted text-lg mt-4 max-w-[520px]">Ten disciplines. One catalog. Choose where your next skill comes from.</p>
          </motion.div>
        </div>
      </section>

      {/* Gapless bento: 5 cols x 2 rows = 10 cells, 10 categories at 1x1 each. Zero voids. */}
      <section className="pb-32 md:pb-48 px-8 lg:px-16 bg-white">
        <div className="max-w-[1280px] mx-auto">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
            variants={stagger}
            className="grid grid-cols-2 md:grid-cols-5 auto-rows-[minmax(170px,220px)] gap-4 grid-flow-dense"
          >
            {categories.map((cat) => {
              const Icon = categoryIcon(cat.icon);
              return (
                <motion.div key={cat.id} variants={fadeUp}>
                  <Link
                    href={`/categories/${cat.id}`}
                    className="group flex flex-col justify-between h-full p-6 bg-bg-soft border border-line rounded-xl hover:border-gold hover:-translate-y-1 transition-all duration-300"
                  >
                    <Icon size={24} weight="duotone" className="text-gold-dark transition-transform duration-500 group-hover:scale-110" />
                    <div>
                      <h3 className="text-sm font-bold text-ink-strong">{cat.title}</h3>
                      <span className="text-xs text-ink-muted">{cat.count} course{cat.count !== 1 ? "s" : ""}</span>
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
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { categories, courses, ready } = useCatalog();
  const category = categories.find((c) => c.id === id);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const scoped = useMemo(() => {
    if (!category) return [];
    return applyFilters(
      courses.filter((c) => c.category === category.id),
      filters,
      "popular"
    );
  }, [category, courses, filters]);

  if (!ready) return <PageLoader />;

  if (!category) {
    return (
      <div className="min-h-[60dvh] flex items-center justify-center px-8">
        <EmptyState
          pose="sad"
          title="Category not found"
          ctaLabel="Browse all categories"
          ctaTo="/categories"
        />
      </div>
    );
  }

  const Icon = categoryIcon(category.icon);

  return (
    <main className="overflow-x-hidden w-full max-w-full">

      {/* ATTENTION — Ink section with oversized numerals, image on right */}
      <section className="relative px-8 lg:px-16 pt-36 pb-20 bg-ink-strong overflow-hidden aw-grain">
        <div className="absolute inset-0">
          <img src={`https://picsum.photos/seed/cat${category.id}/1920/700`} alt="" aria-hidden="true" className="w-full h-full object-cover opacity-25 grayscale contrast-125" />
          <div className="absolute inset-0 aw-dark-wash" />
        </div>
        <div className="max-w-[1280px] mx-auto w-full relative">
          <motion.nav
            aria-label="Breadcrumb"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50 mb-7"
          >
            <Link href="/categories" className="hover:text-gold transition-colors">Categories</Link>
            <span aria-hidden="true">/</span>
            <span className="text-white/80">{category.title}</span>
          </motion.nav>
          <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-14 items-end">
            <div>
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="w-20 h-20 rounded-2xl bg-gold flex items-center justify-center mb-8"
              >
                <Icon size={38} weight="duotone" className="text-ink-strong" />
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="aw-hero-h1 font-display text-white"
                style={{ fontSize: "clamp(2.4rem,5vw,4.6rem)" }}
              >
                {category.title}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="text-white/65 text-lg mt-5 max-w-[520px]"
              >
                {category.count} course{category.count !== 1 ? "s" : ""} designed by Bhutanese practitioners, from first principles to portfolio-ready projects.
              </motion.p>
            </div>
            <div className="hidden lg:block">
              <motion.div
                initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.15 }}
                className="flex flex-col items-end"
              >
                <span className="font-display font-bold leading-none text-[12rem] text-white/5 select-none">
                  {String(categories.indexOf(category) + 1).padStart(2, "0")}
                </span>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* BODY — Same editorial listing pattern as /courses */}
      <section className="pb-32 md:pb-48 px-8 lg:px-16 bg-bg-soft">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10 pt-16">
          <div>
            <FilterSidebar filters={filters} setFilters={setFilters} resultCount={scoped.length} />
          </div>

          <div>
            {scoped.length ? (
              <motion.div
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                variants={stagger}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6"
              >
                {scoped.map((c) => (
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

      {/* ACTION — Slim banner */}
      <section className="pb-32 md:pb-48 px-8 lg:px-16 bg-bg-soft">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-10 bg-ink-strong rounded-2xl relative overflow-hidden aw-grain">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_20%,rgba(255,182,6,0.22)_0%,transparent_55%)]" />
            <h3 className="font-display text-xl font-semibold text-white relative">Cannot decide? Browse every category.</h3>
            <Link href="/categories" className="btn btn-primary btn-lg relative flex-shrink-0">All categories</Link>
          </div>
        </div>
      </section>
    </main>
  );
}