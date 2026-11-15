"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import Mascot from "@/components/Mascot";

import { photo } from "@/lib/photos";
export default function NotFound() {
  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <section className="relative min-h-[100dvh] flex items-center justify-center px-8 py-32 bg-ink-strong overflow-hidden aw-grain">
        <div className="absolute inset-0">
          <img src={photo("lostpath")} alt="" aria-hidden="true" className="w-full h-full object-cover opacity-25 grayscale contrast-125" />
          <div className="absolute inset-0 aw-dark-wash" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 text-center w-full max-w-6xl mx-auto"
        >
          <Mascot pose="sad" size={120} className="mx-auto mb-8" />
          <h1 className="aw-hero-h1 font-display text-white w-full">
            Lost
            <span className="aw-inline-pill mx-3" style={{ backgroundImage: `url(${photo("found")})` }} aria-hidden="true" />
            somewhere?
          </h1>
          <p className="text-white/65 text-lg mt-6 max-w-[480px] mx-auto">
            This page does not exist. Let&apos;s get you back to learning.
          </p>
          <div className="flex gap-4 justify-center flex-wrap mt-10">
            <Link href="/" className="btn btn-primary btn-lg">
              Back to Home <ArrowRight size={14} weight="bold" />
            </Link>
            <Link href="/courses" className="btn btn-lg border-2 border-white/40 text-white bg-white/10 backdrop-blur-sm hover:bg-white hover:text-ink-strong hover:border-white transition-all">
              <MagnifyingGlass size={14} weight="bold" /> Browse courses
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}