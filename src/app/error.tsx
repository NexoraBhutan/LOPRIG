"use client";

import Link from "next/link";
import Mascot from "@/components/Mascot";

/**
 * App Router route error boundary. This replaces the class-based
 * ErrorBoundary the Vite app mounted around <Routes>: Next provides this
 * hook itself, so the component only needs to render the recovery UI.
 */
export default function RouteError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[80dvh] flex items-center justify-center px-8 bg-white">
      <div className="max-w-md text-center flex flex-col items-center gap-6">
        <Mascot pose="sad" size={120} />
        <h1 className="text-2xl font-semibold text-ink-strong">Something went wrong</h1>
        <p className="text-ink-muted text-[0.95rem] leading-relaxed">
          An unexpected error occurred. Please try again or return to the home page.
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            className="bg-gold text-ink-strong font-bold text-xs tracking-widest uppercase px-6 py-3 rounded-[4px] border-2 border-gold hover:bg-gold-dark hover:border-gold-dark transition-all cursor-pointer"
            onClick={reset}
          >
            Try Again
          </button>
          <Link href="/" className="bg-transparent text-ink-strong font-bold text-xs tracking-widest uppercase px-6 py-3 rounded-[4px] border-2 border-line-strong hover:border-gold transition-all no-underline">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}