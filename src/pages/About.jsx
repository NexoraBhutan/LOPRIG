import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Target, Users, BookOpen } from "@phosphor-icons/react";
import Mascot from "../components/Mascot";

const VALUES = [
  { icon: Target, title: "Our mission", body: "Make high-quality, practical education reachable from anywhere in Bhutan, regardless of where a student lives." },
  { icon: Users, title: "Who we serve", body: "Students preparing for exams, professionals upskilling for their careers, and anyone curious to learn something new." },
  { icon: BookOpen, title: "How we teach", body: "Bite-sized video lessons, hands-on projects, and instructors who understand the Bhutanese context." },
];

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

export default function About() {
  return (
    <main className="overflow-x-hidden w-full max-w-full">

      {/* HERO — Cinematic wide, 2-line max */}
      <section className="min-h-[92dvh] flex items-center px-8 lg:px-16 pt-36 pb-20 bg-white aw-gold-wash">
        <div className="max-w-[1280px] mx-auto w-full grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-16 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="aw-hero-h1 font-display text-ink-strong w-full max-w-5xl mb-7">
              Skills built for Bhutan&apos;s future
            </h1>
            <p className="text-ink-muted text-lg leading-relaxed max-w-[560px]">
              Lop-rig is an online learning platform built for Bhutanese students, professionals, and
              lifelong learners who want practical, affordable, and locally relevant education.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center overflow-hidden"
          >
            <div className="group">
              <Mascot pose="idle" size={220} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* VALUES — Editorial Numbered List */}
      <section className="py-32 md:py-48 px-8 lg:px-16 bg-bg-soft">
        <div className="max-w-[1280px] mx-auto">
          <motion.h2
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp} transition={{ duration: 0.6 }}
            className="text-3xl md:text-5xl tracking-tighter font-medium text-ink-strong mb-20"
          >
            What drives us
          </motion.h2>

          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
            variants={stagger}
            className="flex flex-col gap-10"
          >
            {VALUES.map((v) => (
              <motion.div
                key={v.title}
                variants={fadeUp}
                className="p-10 bg-white border-2 border-line rounded-xl hover:border-gold hover:shadow-[0_8px_32px_rgba(255,182,6,0.1)] transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-start gap-5">
                  <div className="w-[52px] h-[52px] rounded-xl bg-gold-soft flex items-center justify-center flex-shrink-0">
                    <v.icon size={24} weight="duotone" className="text-gold-dark" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2.5">{v.title}</h3>
                    <p className="text-ink-muted text-[0.95rem] leading-relaxed">{v.body}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* STORY — Full-Width Block */}
      <section className="py-32 md:py-48 px-8 lg:px-16 bg-white">
        <div className="max-w-[1280px] mx-auto">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp} transition={{ duration: 0.8 }}
            className="py-20 px-12 bg-bg-soft rounded-2xl border-2 border-line"
          >
            <h2 className="text-3xl md:text-5xl tracking-tighter font-medium text-ink-strong mb-6">
              Built by learners, for learners
            </h2>
            <p className="text-ink-muted text-lg leading-relaxed max-w-[720px] mb-8">
              Lop-rig started with a simple idea: education in Bhutan shouldn&apos;t be limited by geography.
              Whether you&apos;re a student in Thimphu, a teacher in Trashigang, or an entrepreneur in Punakha,
              Lop-rig brings the same quality of learning to your screen, in a format built around Gross
              National Happiness values of balance, community, and sustainable growth.
            </p>
            <span className="text-xs font-bold text-gold-dark uppercase tracking-widest">A product by Nexora</span>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 md:py-48 px-8 lg:px-16 bg-white">
        <div className="max-w-[1280px] mx-auto">
          <div className="py-24 px-12 rounded-2xl bg-ink-strong relative overflow-hidden text-center">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,182,6,0.1)_0%,transparent_60%)]" />
            <h2 className="text-3xl md:text-5xl tracking-tighter font-semibold text-white leading-tight relative z-10">
              Have a question or some feedback?
            </h2>
            <p className="text-white/65 text-lg mt-6 mb-10 relative z-10">We read every message. Reach out and tell us what you&apos;d like to see next.</p>
            <Link to="/signup" className="relative z-10 btn btn-primary btn-lg">
              Create an account <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
