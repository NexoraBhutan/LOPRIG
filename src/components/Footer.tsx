"use client";

import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react";
import { FacebookGlyph, InstagramGlyph, LinkedinGlyph, YoutubeGlyph } from "@/components/SocialGlyphs";
import Logo from "@/components/Logo";

const SOCIALS = [FacebookGlyph, InstagramGlyph, LinkedinGlyph, YoutubeGlyph];
const SOCIAL_LABELS = ["Facebook", "Instagram", "LinkedIn", "YouTube"];

export default function Footer() {
  return (
    <footer className="bg-ink-strong text-white relative overflow-hidden aw-grain">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,182,6,0.12)_0%,transparent_55%)] pointer-events-none" />
      <div className="max-w-[1280px] mx-auto px-8 lg:px-16 pt-24 pb-10 relative">
        <Link href="/courses" className="block group">
          <span className="block font-display font-bold tracking-tighter leading-none text-[clamp(3rem,9vw,8rem)] text-white group-hover:text-gold transition-colors duration-500">
            Start learning today
          </span>
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gold">
            Browse all courses <ArrowUpRight size={16} weight="bold" className="transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" />
          </span>
        </Link>

        <div className="mt-16 pt-12 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr] gap-12">
          <div className="flex flex-col gap-5">
            <Logo tone="light" />
            <p className="text-white/50 text-sm leading-relaxed max-w-[320px]">
              Lop-rig is Bhutan&apos;s home for practical, skills-first online learning, built for students,
              professionals, and lifelong learners across the Kingdom.
            </p>
            <div className="flex gap-3">
              {SOCIALS.map((Glyph, i) => (
                <span key={SOCIAL_LABELS[i]} role="link" aria-label={SOCIAL_LABELS[i]} aria-disabled="true" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/60 cursor-default hover:bg-gold hover:text-ink-strong transition-colors" title="Coming soon">
                  <Glyph />
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest">Platform</h4>
            {["Home", "Courses", "Categories", "About"].map((label) => (
              <Link key={label} href={`/${label === "Home" ? "" : label.toLowerCase()}`} className="text-sm text-white/60 hover:text-gold transition-colors no-underline w-fit">{label}</Link>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest">Categories</h4>
            {[["Programming", "programming"], ["Data Science", "data-science"], ["Business", "business"], ["Design", "design"]].map(([label, slug]) => (
              <Link key={slug} href={`/categories/${slug}`} className="text-sm text-white/60 hover:text-gold transition-colors no-underline w-fit">{label}</Link>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest">Support</h4>
            {[["Contact", "/about"], ["FAQ", "/about"], ["Terms", "/about"], ["Privacy Policy", "/about"], ["Help Center", "/about"]].map(([label, to]) => (
              <Link key={label} href={to} className="text-sm text-white/60 hover:text-gold transition-colors no-underline w-fit">{label}</Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 relative">
        <div className="max-w-[1280px] mx-auto px-8 lg:px-16 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-white/40">&copy; 2026 Lop-rig. All rights reserved.</span>
          <span className="text-xs text-white/40">Built for learners in Bhutan</span>
          <a href="https://nexero-p6zr.onrender.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-gold transition-colors no-underline">
            A Nexora product <ArrowUpRight size={11} />
          </a>
        </div>
      </div>
    </footer>
  );
}