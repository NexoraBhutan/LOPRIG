"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowSquareOut, SignOut, List, X, type Icon } from "@phosphor-icons/react";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";

export interface PortalNavItem {
  href: string;
  label: string;
  icon: Icon;
  /** Defaults to "exact match, or a sub-page of href". */
  match?: (pathname: string) => boolean;
  badge?: number;
}

/** Sidebar + content + footer frame shared by the teacher portal and the admin portal. */
export default function PortalShell({
  label,
  home,
  nav,
  children,
}: {
  label: string;
  home: string;
  nav: PortalNavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? home;
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (item: PortalNavItem) =>
    item.match ? item.match(pathname) : pathname === item.href || (item.href !== home && pathname.startsWith(`${item.href}/`));

  const sidebar = (
    <div className="relative flex flex-col h-full bg-ink-strong text-white overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,rgba(255,182,6,0.18)_0%,transparent_55%)] pointer-events-none" />
      <div className="relative px-6 pt-7 pb-8 flex items-center justify-between">
        <Link href={home} onClick={close} className="no-underline"><Logo tone="light" /></Link>
        <button onClick={close} className="lg:hidden text-white/70 hover:text-white bg-transparent border-none cursor-pointer" aria-label="Close menu">
          <X size={20} weight="bold" />
        </button>
      </div>
      <p className="relative px-6 mb-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-gold">{label}</p>
      <nav className="relative flex flex-col gap-1 px-3" aria-label={label}>
        {nav.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={close}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium no-underline transition-colors ${
                active ? "bg-gold text-ink-strong" : "text-white/75 hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon size={18} weight={active ? "fill" : "regular"} />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span className={`min-w-[22px] px-1.5 py-0.5 rounded-full text-[0.7rem] font-bold text-center ${active ? "bg-ink-strong text-gold" : "bg-gold text-ink-strong"}`}>
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
        <div className="my-4 mx-4 border-t border-white/10" />
        <Link href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/10 no-underline transition-colors">
          <ArrowSquareOut size={18} /> View student site
        </Link>
      </nav>

      {user && (
        <div className="relative mt-auto m-3 p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-ink-strong bg-gold" aria-hidden="true">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold truncate">{user.name}</span>
              <span className="block text-xs text-white/50 truncate">{user.email}</span>
            </span>
          </div>
          <button
            onClick={async () => { await logout(); router.push("/"); }}
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-white/80 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors"
          >
            <SignOut size={14} weight="bold" /> Log out
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-bg-soft">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-[264px] z-40">{sidebar}</aside>

      <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-5 h-16 bg-ink-strong">
        <Link href={home} className="no-underline"><Logo tone="light" size="sm" /></Link>
        <button onClick={() => setOpen(true)} className="text-white bg-transparent border-none cursor-pointer" aria-label="Open menu" aria-expanded={open}>
          <List size={22} weight="bold" />
        </button>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button className="absolute inset-0 w-full bg-black/50 border-none cursor-pointer" aria-label="Close menu" onClick={close} />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-elevated">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-[264px] flex flex-col min-h-[100dvh]">
        <main className="flex-1">
          <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-12 py-8 lg:py-12">{children}</div>
        </main>
        <PortalFooter label={label} />
      </div>
    </div>
  );
}

/** Compact version of the student site's footer: dark ink, gold glow, logo and quick links. */
function PortalFooter({ label }: { label: string }) {
  return (
    <footer className="relative overflow-hidden bg-ink-strong text-white mt-8">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,182,6,0.12)_0%,transparent_60%)] pointer-events-none" />
      <div className="relative max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-12 py-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <Logo tone="light" />
          <p className="text-sm text-white/55 mt-3 max-w-[360px]">
            Lop-rig {label.toLowerCase()} · Learn. Grow. Build your future, made in Bhutan.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/" className="text-white/70 hover:text-gold no-underline transition-colors">Student site</Link>
          <Link href="/courses" className="text-white/70 hover:text-gold no-underline transition-colors">Courses</Link>
          <Link href="/about" className="text-white/70 hover:text-gold no-underline transition-colors">About</Link>
        </nav>
      </div>
      <div className="relative border-t border-white/10">
        <p className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-12 py-4 text-xs text-white/40">
          © {new Date().getFullYear()} Lop-rig. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
