"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, Rocket, Certificate, Code, Palette,
  ChartLineUp, Globe, BookOpen, Lightbulb, CaretLeft, CaretRight, Pause, Play,
} from "@phosphor-icons/react";
import { categories, testimonials, learningPaths, getCourseById } from "@/data/courses";
import { gsap, useGSAP } from "@/utils/gsap";

const ICONS: Record<string, typeof Code> = {
  Code, Palette, ChartLineUp, Globe, BookOpen, Lightbulb,
  Bullhorn: Rocket, ShieldAlt: Certificate, Calculator: Code, Briefcase: BookOpen, Language: Globe, Rocket,
};

const FAQS = [
  { q: "Do I need any prior experience to start a course?", a: "No. Most Lop-rig courses are designed for absolute beginners, and each course page clearly lists any requirements before you enroll." },
  { q: "Can I access courses on my phone?", a: "Yes. Lop-rig works on desktop, tablet, and mobile, so you can learn from anywhere in Bhutan with an internet connection." },
  { q: "What payment methods are supported?", a: "You can pay using Mobile Banking, Bank Transfer, Card, or a Digital Wallet during checkout. All payment flows shown are for demo purposes." },
  { q: "Do I get a certificate after finishing a course?", a: "Yes, every course includes a certificate of completion once you finish 100% of the lessons." },
];

const MARQUEE = ["Web Development", "Data Science", "Digital Marketing", "Graphic Design", "Business", "Photography", "Language", "Finance"];

const SCRUB_SENTENCE = "Learning should not depend on where you live. Lop-rig brings practical mentors, real projects, and verified certificates to every screen in Bhutan.";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

export default function Home() {
  const [openFaq, setOpenFaq] = useState(0);
  const [activeAccordion, setActiveAccordion] = useState(0);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const carouselInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (carouselPaused || reducedMotion) {
      if (carouselInterval.current) clearInterval(carouselInterval.current);
      return;
    }
    carouselInterval.current = setInterval(() => setCarouselIdx((p) => (p + 1) % testimonials.length), 5000);
    return () => { if (carouselInterval.current) clearInterval(carouselInterval.current); };
  }, [carouselPaused, reducedMotion]);

  useGSAP(() => {
    if (reducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".aw-scrub-word").forEach((word) => {
        gsap.fromTo(word, { opacity: 0.12 }, {
          opacity: 1,
          ease: "none",
          scrollTrigger: { trigger: ".aw-scrub-block", start: "top 75%", end: "bottom 45%", scrub: 0.6 },
        });
      });

      gsap.utils.toArray<HTMLElement>(".aw-scale-img").forEach((img) => {
        gsap.fromTo(img, { scale: 1.15 }, {
          scale: 1, ease: "none",
          scrollTrigger: { trigger: img, start: "top 90%", end: "top 40%", scrub: 0.8 },
        });
        gsap.to(img, {
          opacity: 0.25, ease: "none",
          scrollTrigger: { trigger: img, start: "center 40%", end: "center top", scrub: 0.8 },
        });
      });
    }, rootRef);
    return () => ctx.revert();
  }, { scope: rootRef, dependencies: [reducedMotion] });

  return (
    <main ref={rootRef} className="overflow-x-hidden w-full max-w-full">

      {/* ATTENTION — Cinematic Center Hero */}
      <section className="relative min-h-[100dvh] flex items-center justify-center px-6 lg:px-16 pt-32 pb-24 overflow-hidden bg-ink-strong">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src="https://picsum.photos/seed/bhutanlearn/1920/1080"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover grayscale contrast-125 opacity-90"
          />
          <div className="absolute inset-0 aw-dark-wash" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-6xl mx-auto text-center"
        >
          <h1 className="aw-hero-h1 font-display text-white w-full">
            Build
            <span className="aw-inline-pill mx-3" style={{ backgroundImage: "url(https://picsum.photos/seed/craft/400/200)" }} aria-hidden="true" />
            real skills for Bhutan&apos;s
            <br className="hidden md:block" />
            bold
            <span className="aw-inline-pill mx-3" style={{ backgroundImage: "url(https://picsum.photos/seed/future/400/200)" }} aria-hidden="true" />
            future
          </h1>
          <p className="text-white/70 text-lg leading-relaxed max-w-[560px] mx-auto mt-7">
            Web development, data science, design, and business taught by Bhutanese
            instructors. Self-paced, project-based, certified.
          </p>
          <div className="flex gap-4 justify-center flex-wrap mt-11">
            <Link href="/courses" className="btn btn-primary btn-lg">
              Explore Courses <ArrowRight size={14} weight="bold" />
            </Link>
            <Link href="/signup" className="btn btn-lg border-2 border-white/40 text-white bg-white/10 backdrop-blur-sm hover:bg-white hover:text-ink-strong hover:border-white transition-all">
              Start Learning
            </Link>
          </div>
        </motion.div>
      </section>

      {/* INTEREST — Gapless Bento. 4 cols x 2 rows = 8 cells. A(2x2=4) + B(2x1=2) + C(1x1=1) + D(1x1=1) = 8. Zero voids. */}
      <section className="py-32 md:py-48 px-8 lg:px-16 bg-white aw-gold-wash">
        <div className="max-w-[1280px] mx-auto">
          <h2 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong max-w-[700px] mb-16 md:mb-20">
            Everything you need to grow, in one dense grid
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 auto-rows-[minmax(220px,280px)] gap-5 grid-flow-dense">
            <div className="md:col-span-2 md:row-span-2 bg-bg-soft rounded-xl overflow-hidden flex flex-col group">
              <div className="flex-1 overflow-hidden min-h-[220px]">
                <img src="https://picsum.photos/seed/courses/800/600" alt="Students collaborating on a coding project" loading="lazy" width="800" height="600" className="aw-scale-img w-full h-full object-cover grayscale-[10%] contrast-[110%] transition-transform duration-700 ease-out group-hover:scale-105" />
              </div>
              <div className="p-7">
                <h3 className="text-lg font-semibold mb-1.5 font-display">1,200+ video lessons, built for Bhutan</h3>
                <p className="text-ink-muted text-sm leading-relaxed">From programming to design, each course ends in a real portfolio project with lifetime access and verified certificates.</p>
              </div>
            </div>

            <div className="md:col-span-2 md:row-span-1 bg-bg-soft rounded-xl overflow-hidden flex">
              {categories.slice(0, 4).map((cat, i) => {
                const Icon = ICONS[cat.icon] || Code;
                return (
                  <div
                    key={cat.id}
                    className={`flex-1 min-w-[52px] flex flex-col items-center justify-center gap-2 px-3 py-5 border-r border-line last:border-r-0 cursor-pointer transition-all duration-300 ${activeAccordion === i ? "flex-[4] bg-gold-soft" : "hover:bg-gold-soft/50"}`}
                    onMouseEnter={() => setActiveAccordion(i)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={activeAccordion === i}
                    onKeyDown={(e) => e.key === "Enter" && setActiveAccordion(i)}
                  >
                    <Icon size={24} weight="duotone" className="text-gold-dark" />
                    <span className="text-xs font-bold text-ink-strong whitespace-nowrap font-display">{cat.title}</span>
                    <div className={`overflow-hidden transition-all duration-300 ${activeAccordion === i ? "max-h-16 opacity-100 mt-2" : "max-h-0 opacity-0"}`}>
                      <span className="text-xs text-ink-muted">{cat.count} courses</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-bg-soft rounded-xl p-8 flex flex-col gap-4 group hover:-translate-y-1 transition-transform duration-500 overflow-hidden">
              <div className="w-[52px] h-[52px] rounded-xl flex items-center justify-center bg-gold text-ink-strong transition-transform duration-700 group-hover:scale-110">
                <Certificate size={24} weight="duotone" />
              </div>
              <h3 className="text-base font-semibold font-display">Earn certificates</h3>
              <p className="text-ink-muted text-[0.85rem] leading-relaxed">Finish any course and receive a verified certificate for your career.</p>
            </div>

            <div className="bg-ink-strong rounded-xl p-8 flex flex-col gap-4 group hover:-translate-y-1 transition-transform duration-500 overflow-hidden relative">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(255,182,6,0.22)_0%,transparent_60%)]" />
              <div className="w-[52px] h-[52px] rounded-xl flex items-center justify-center bg-gold text-ink-strong transition-transform duration-700 group-hover:scale-110 relative">
                <Rocket size={24} weight="duotone" />
              </div>
              <h3 className="text-base font-semibold font-display text-white relative">Learn at your pace</h3>
              <p className="text-white/60 text-[0.85rem] leading-relaxed relative">Pause, resume, revisit. Project-based lessons, never endless theory.</p>
            </div>
          </div>
        </div>
      </section>

      {/* DESIRE — Scrubbing text reveal */}
      <section className="aw-scrub-block py-32 md:py-48 px-8 lg:px-16 bg-bg-soft">
        <div className="max-w-[900px] mx-auto text-center">
          <p className="font-display text-[clamp(1.6rem,3.4vw,2.8rem)] leading-[1.3] tracking-tight font-medium text-ink-strong">
            {SCRUB_SENTENCE.split(" ").map((w, i) => (
              <span key={i} className="aw-scrub-word">{w}{"\u00A0"}</span>
            ))}
          </p>
        </div>
      </section>

      {/* DESIRE — Pinned narrative, title left, gallery scrolls right */}
      <section className="py-32 md:py-48 px-8 lg:px-16 bg-white">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20">
          <div className="lg:sticky lg:top-32 self-start">
            <h2 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong leading-[1.05]">From sign-up to certificate in four moves</h2>
            <p className="text-ink-muted text-lg mt-5 max-w-[400px] leading-relaxed">A short path, designed around busy lives and real outcomes.</p>
            <Link href="/signup" className="btn btn-secondary btn-lg mt-9">
              Create free account <ArrowRight size={14} weight="bold" />
            </Link>
          </div>

          <div className="flex flex-col gap-8">
            {[
              { t: "Create your account", d: "Sign up in seconds and set up your learner profile." },
              { t: "Find your discipline", d: "Search or browse categories shaped around Bhutanese career paths." },
              { t: "Enroll in minutes", d: "Simple checkout with Mobile Banking, cards, or wallets." },
              { t: "Build and get certified", d: "Watch lessons, ship projects, track progress, earn proof." },
            ].map((s, i) => (
              <div key={s.t} className="aw-stack-card p-10 bg-bg-soft border border-line rounded-2xl hover:border-gold transition-colors duration-300" style={{ top: `${120 + i * 16}px` }}>
                <span className="inline-block text-xs font-bold tracking-widest text-gold-dark bg-gold-soft px-3 py-1.5 rounded-full mb-4">0{i + 1}</span>
                <h3 className="font-display text-xl font-semibold mb-2.5">{s.t}</h3>
                <p className="text-ink-muted text-[0.95rem] leading-relaxed">{s.d}</p>
                <div className="mt-6 overflow-hidden rounded-xl">
                  <img src={`https://picsum.photos/seed/step${i + 1}/800/420`} alt={`Illustration for step ${i + 1}: ${s.t}`} loading="lazy" className="aw-scale-img w-full h-44 object-cover grayscale-[15%] contrast-110 transition-transform duration-700 ease-out hover:scale-105" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DESIRE — Gallery with scale and fade */}
      <section className="py-32 md:py-48 px-8 lg:px-16 bg-ink-strong relative overflow-hidden aw-grain">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,182,6,0.14)_0%,transparent_60%)]" />
        <div className="max-w-[1280px] mx-auto relative">
          <h2 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-white mb-16 md:mb-20 max-w-[640px]">
            Explore by discipline
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { seed: "atelier", label: "Design", alt: "Creative design workspace with color swatches and wireframes" },
              { seed: "terminal", label: "Development", alt: "Developer writing code on a dual-monitor setup" },
              { seed: "signal", label: "Marketing", alt: "Digital marketing analytics dashboard on screen" },
            ].map((item) => (
              <div key={item.seed} className="relative rounded-xl overflow-hidden aspect-[3/2] group">
                <img src={`https://picsum.photos/seed/${item.seed}/600/400`} alt={item.alt} loading="lazy" width="600" height="400" className="aw-scale-img w-full h-full object-cover grayscale-[15%] contrast-[110%] transition-transform duration-700 ease-out group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <span className="absolute bottom-4 left-4 bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold px-3.5 py-1.5 rounded-full tracking-wider uppercase">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Infinite marquee */}
      <section className="py-10 overflow-hidden border-t border-b border-line bg-white">
        <div className="aw-marquee-track flex gap-16 whitespace-nowrap w-max" aria-label="Course topics" role="group">
          {[...MARQUEE, ...MARQUEE, ...MARQUEE].map((item, i) => (
            <span key={i} className="font-display text-xl font-semibold text-ink-muted/40 hover:text-gold-dark transition-colors flex-shrink-0 cursor-default">
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* Testimonial carousel */}
      <section className="py-32 md:py-48 px-8 lg:px-16 bg-bg-soft">
        <div className="max-w-[1280px] mx-auto">
          <h2 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong mb-16 md:mb-20">
            Loved by learners across the Kingdom
          </h2>

          <div className="overflow-hidden rounded-2xl">
            <div className="flex transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ transform: `translateX(-${carouselIdx * 100}%)` }}>
              {testimonials.map((t) => (
                <div key={t.name} className="min-w-full p-1">
                  <div className="bg-white rounded-xl p-11 min-h-[300px] flex flex-col md:flex-row items-start md:items-center gap-8">
                    <div className="flex -space-x-4">
                      {testimonials.slice(0, 3).map((p, j) => (
                        <span key={j} className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg border-[3px] border-white bg-gold-dark" style={{ background: ["#c88e00", "#1a1a1a", "#db5246"][j % 3] }}>
                          {p.name.charAt(0)}
                        </span>
                      ))}
                    </div>
                    <div>
                      <p className="text-ink text-xl leading-[1.7] font-medium max-w-[640px]">
                        &ldquo;{t.quote}&rdquo;
                      </p>
                      <div className="flex items-center gap-3.5 mt-6">
                        <strong className="block text-sm text-ink-strong">{t.name}</strong>
                        <span className="text-ink-muted text-xs">— {t.role}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                onClick={() => setCarouselPaused((p) => !p)}
                className="btn-icon"
                aria-label={carouselPaused ? "Resume auto-advance" : "Pause auto-advance"}
              >
                {carouselPaused ? <Play size={14} weight="fill" /> : <Pause size={14} weight="fill" />}
              </button>
              <button onClick={() => setCarouselIdx((p) => (p - 1 + testimonials.length) % testimonials.length)} className="btn-icon" aria-label="Previous">
                <CaretLeft size={14} weight="bold" />
              </button>
              <div className="flex gap-2.5">
                {testimonials.map((_, i) => (
                  <button key={i} onClick={() => setCarouselIdx(i)} className={`carousel-dot ${i === carouselIdx ? "active" : ""}`} aria-label={`Slide ${i + 1}`} />
                ))}
              </div>
              <button onClick={() => setCarouselIdx((p) => (p + 1) % testimonials.length)} className="btn-icon" aria-label="Next">
                <CaretRight size={14} weight="bold" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Learning paths — stacking cards */}
      <section className="py-32 md:py-48 px-8 lg:px-16 bg-white">
        <div className="max-w-[1280px] mx-auto">
          <h2 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong mb-16 md:mb-20 max-w-[640px]">
            Follow a path, not a playlist
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            {learningPaths.map((path, pi) => (
              <div
                key={path.id}
                className="aw-stack-card pt-14 pb-9 px-7 bg-bg-soft rounded-2xl flex flex-col gap-5 border border-line overflow-hidden"
                style={{ borderTopWidth: "6px", borderTopColor: path.color, top: `${110 + pi * 18}px` }}
              >
                <div className="overflow-hidden rounded-xl -mt-6 mb-2">
                  <img src={`https://picsum.photos/seed/path${path.id}/600/320`} alt={`Cover illustration for the ${path.title} learning path`} loading="lazy" className="aw-scale-img w-full h-40 object-cover grayscale-[12%] contrast-110 transition-transform duration-700 ease-out hover:scale-105" />
                </div>
                <h3 className="font-display text-lg font-semibold">{path.title}</h3>
                <ul className="flex flex-col gap-3">
                  {path.courseIds.map((id, i) => {
                    const c = getCourseById(id);
                    return (
                      <li key={id} className="flex items-center gap-3.5 text-[0.92rem] text-ink hover:translate-x-1.5 transition-transform">
                        <span className="w-7 h-7 rounded-full bg-bg-sunken flex items-center justify-center text-xs font-bold text-ink-strong flex-shrink-0">{i + 1}</span>
                        {c?.title}
                      </li>
                    );
                  })}
                </ul>
                <Link href={`/courses/${path.courseIds[0]}`} className="btn btn-outline btn-sm mt-auto self-start">
                  Start this path
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-32 md:py-48 px-8 lg:px-16 bg-bg-soft">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-12">
          <div>
            <h2 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong leading-tight">
              Answers, before you even ask
            </h2>
            <p className="text-ink-muted text-lg mt-4 leading-relaxed max-w-[380px]">Short, honest, no fine print. Still stuck? Talk to us.</p>
          </div>

          <div className="max-w-[720px] flex flex-col gap-3.5" role="list">
            {FAQS.map((f, i) => (
              <div key={f.q} className={`border-2 rounded-xl bg-white overflow-hidden transition-all duration-300 ${openFaq === i ? "border-gold shadow-[0_4px_16px_rgba(255,182,6,0.12)]" : "border-line-strong"}`} role="listitem">
                <button
                  className="w-full flex items-center justify-between gap-4 px-7 py-5 bg-transparent border-none cursor-pointer text-left font-medium text-ink-strong hover:text-gold-dark transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  aria-expanded={openFaq === i}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-btn-${i}`}
                >
                  {f.q}
                  <span className="text-xl text-gold-dark font-bold flex-shrink-0">{openFaq === i ? "\u2212" : "+"}</span>
                </button>
                <div
                  id={`faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`faq-btn-${i}`}
                  className={`overflow-hidden transition-all duration-300 ${openFaq === i ? "max-h-[200px]" : "max-h-0"}`}
                >
                  <p className="px-7 pb-5 text-ink-muted text-[0.92rem] leading-relaxed">{f.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ACTION — Massive CTA */}
      <section className="py-32 md:py-48 px-8 lg:px-16 bg-white">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center py-24 md:py-32 px-8 rounded-3xl bg-ink-strong relative overflow-hidden aw-grain">
            <div className="absolute inset-0">
              <img src="https://picsum.photos/seed/celebrate/1600/800" alt="" aria-hidden="true" className="w-full h-full object-cover opacity-25 grayscale contrast-125" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,182,6,0.22)_0%,transparent_60%),linear-gradient(to_bottom,rgba(26,26,26,0.55),rgba(26,26,26,0.85))]" />
            </div>
            <h2 className="font-display text-white font-bold tracking-tighter leading-[1.02] text-[clamp(2.4rem,5vw,4.5rem)] max-w-4xl mx-auto relative z-10">
              Pick a course. Start today.
            </h2>
            <p className="text-white/65 text-lg mt-6 mb-10 relative z-10">Free to sign up. Pay only when you enroll.</p>
            <div className="flex gap-4 justify-center flex-wrap relative z-10">
              <Link href="/signup" className="btn btn-primary btn-lg">
                Create your free account <ArrowRight size={14} weight="bold" />
              </Link>
              <Link href="/courses" className="btn btn-lg border-2 border-white/40 text-white bg-transparent hover:bg-white hover:text-ink-strong hover:border-white transition-all">
                Browse all courses
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}