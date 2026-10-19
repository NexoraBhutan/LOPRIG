"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Target, Users, BookOpen } from "@phosphor-icons/react";
import { gsap, useGSAP } from "@/utils/gsap";
import Mascot from "@/components/Mascot";

const VALUES = [
  { icon: Target, title: "Our mission", body: "Make high-quality, practical education reachable from anywhere in Bhutan, regardless of where a student lives." },
  { icon: Users, title: "Who we serve", body: "Students preparing for exams, professionals upskilling for their careers, and anyone curious to learn something new." },
  { icon: BookOpen, title: "How we teach", body: "Bite-sized video lessons, hands-on projects, and instructors who understand the Bhutanese context." },
] as const;

const STORY = "Lop-rig started with a simple idea: education in Bhutan should not be limited by geography. Whether you are a student in Thimphu, a teacher in Trashigang, or an entrepreneur in Punakha, the same quality of learning reaches your screen.";

export default function About() {
  useGSAP(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".aw-scrub-word").forEach((word) => {
        gsap.fromTo(word, { opacity: 0.12 }, {
          opacity: 1, ease: "none",
          scrollTrigger: { trigger: ".aw-scrub-block", start: "top 78%", end: "bottom 45%", scrub: 0.6 },
        });
      });
      gsap.utils.toArray<HTMLElement>(".aw-scale-img").forEach((img) => {
        gsap.fromTo(img, { scale: 1.15 }, {
          scale: 1, ease: "none",
          scrollTrigger: { trigger: img, start: "top 92%", end: "top 40%", scrub: 0.8 },
        });
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <main className="overflow-x-hidden w-full max-w-full">

      {/* ATTENTION — Artistic Asymmetry: text left, imagery overlapping from bottom-right */}
      <section className="relative min-h-[96dvh] flex items-center px-8 lg:px-16 pt-36 pb-24 bg-white aw-gold-wash overflow-hidden">
        <div className="max-w-[1280px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center relative">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10"
          >
            <h1 className="aw-hero-h1 font-display text-ink-strong w-full max-w-5xl">
              Skills built for Bhutan&apos;s future
            </h1>
            <p className="text-ink-muted text-lg leading-relaxed max-w-[560px] mt-7">
              Lop-rig is an online learning platform built for Bhutanese students, professionals, and
              lifelong learners who want practical, affordable, and locally relevant education.
            </p>
            <div className="flex gap-4 flex-wrap mt-10">
              <Link href="/courses" className="btn btn-primary btn-lg">
                Explore Courses <ArrowRight size={14} weight="bold" />
              </Link>
              <Link href="/signup" className="btn btn-outline btn-lg">
                Join free
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative h-[420px] lg:h-[560px]"
          >
            <div className="absolute inset-x-8 top-0 bottom-16 rounded-3xl overflow-hidden group">
              <img
                src="https://picsum.photos/seed/bhutanvalley/900/1100"
                alt="Valley town in Bhutan at golden hour"
                className="aw-scale-img w-full h-full object-cover grayscale-[15%] contrast-110 transition-transform duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-strong/30 to-transparent" />
            </div>
            <div className="absolute -bottom-2 right-0 bg-gold-soft border border-gold/40 rounded-2xl px-6 py-5 shadow-elevated flex items-center gap-4">
              <Mascot pose="idle" size={72} />
              <div>
                <strong className="block font-display text-ink-strong">Takin approved</strong>
                <span className="text-xs text-ink-muted">Bhutan&apos;s own learning mascot</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* INTEREST — Stacking value cards */}
      <section className="py-32 md:py-48 px-8 lg:px-16 bg-bg-soft">
        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20">
          <div className="lg:sticky lg:top-32 self-start">
            <h2 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong leading-[1.05] max-w-[480px]">
              What drives
              <span className="aw-inline-pill mx-3" style={{ backgroundImage: "url(https://picsum.photos/seed/drive/400/200)" }} aria-hidden="true" />
              us
            </h2>
            <p className="text-ink-muted text-lg mt-5 max-w-[400px] leading-relaxed">Three commitments behind every course we publish.</p>
          </div>

          <div className="flex flex-col gap-8">
            {VALUES.map((v, i) => (
              <div key={v.title} className="aw-stack-card p-10 bg-white border border-line rounded-2xl hover:border-gold transition-colors duration-300" style={{ top: `${120 + i * 16}px` }}>
                <div className="flex items-start gap-5">
                  <div className="w-[52px] h-[52px] rounded-xl bg-gold-soft flex items-center justify-center flex-shrink-0">
                    <v.icon size={24} weight="duotone" className="text-gold-dark" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-semibold mb-2.5">{v.title}</h3>
                    <p className="text-ink-muted text-[0.95rem] leading-relaxed">{v.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DESIRE — Scrubbing story reveal */}
      <section className="aw-scrub-block py-32 md:py-48 px-8 lg:px-16 bg-ink-strong relative overflow-hidden aw-grain">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,182,6,0.14)_0%,transparent_60%)]" />
        <div className="max-w-[900px] mx-auto text-center relative">
          <p className="font-display text-[clamp(1.6rem,3.4vw,2.8rem)] leading-[1.3] tracking-tight font-medium text-white">
            {STORY.split(" ").map((w, i) => (
              <span key={i} className="aw-scrub-word">{w}{"\u00A0"}</span>
            ))}
          </p>
          <span className="inline-block mt-10 text-xs font-bold text-gold tracking-widest uppercase">A product by Nexora</span>
        </div>
      </section>

      {/* ACTION */}
      <section className="py-32 md:py-48 px-8 lg:px-16 bg-white">
        <div className="max-w-[1280px] mx-auto">
          <div className="py-24 md:py-32 px-8 rounded-3xl bg-ink-strong relative overflow-hidden aw-grain text-center">
            <div className="absolute inset-0">
              <img src="https://picsum.photos/seed/callback/1600/800" alt="" aria-hidden="true" className="w-full h-full object-cover opacity-25 grayscale contrast-125" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,182,6,0.22)_0%,transparent_60%),linear-gradient(to_bottom,rgba(26,26,26,0.55),rgba(26,26,26,0.85))]" />
            </div>
            <h2 className="font-display text-white font-bold tracking-tighter leading-[1.02] text-[clamp(2.2rem,5vw,4.2rem)] max-w-3xl mx-auto relative z-10">
              Have a question or some feedback?
            </h2>
            <p className="text-white/65 text-lg mt-6 mb-10 relative z-10">We read every message. Tell us what you would like to see next.</p>
            <Link href="/signup" className="btn btn-primary btn-lg relative z-10">
              Create an account <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}