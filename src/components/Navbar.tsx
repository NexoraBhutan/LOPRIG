"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MagnifyingGlass, Bell, List, X, CaretDown, House, GraduationCap, User, SignOut, Fire, Diamond, Chalkboard } from "@phosphor-icons/react";
import { usesSiteChrome } from "@/utils/routes";
import { useAuth } from "@/context/AuthContext";
import { useEnrollment } from "@/context/EnrollmentContext";
import Logo from "@/components/Logo";
import type { NavLinkItem } from "@/types";

const NAV_LINKS: NavLinkItem[] = [
  { to: "/", label: "Home" },
  { to: "/courses", label: "Courses" },
  { to: "/categories", label: "Categories" },
  { to: "/about", label: "About" },
];

/**
 * react-router's NavLink had an `isActive` render prop; App Router has no
 * equivalent, so active state is derived from usePathname instead.
 */
function useIsActive() {
  const pathname = usePathname() ?? "/";
  return useCallback(
    (to: string, end = false) => {
      if (end) return pathname === to;
      return pathname === to || pathname.startsWith(`${to}/`);
    },
    [pathname]
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { streak, xp } = useEnrollment();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const profileRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const isActive = useIsActive();
  const isTeacher = user?.role === "TEACHER";
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    const sentinel = document.createElement("div");
    sentinel.style.cssText = "position:absolute;top:12px;height:1px;width:1px;pointer-events:none;";
    document.body.prepend(sentinel);
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting));
    io.observe(sentinel);
    return () => { io.disconnect(); sentinel.remove(); };
  }, []);

  useEffect(() => {
    const onInteract = (e: MouseEvent | KeyboardEvent) => {
      if (e.type === "mousedown" && profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (e.type === "keydown" && (e as KeyboardEvent).key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", onInteract);
    document.addEventListener("keydown", onInteract);
    return () => { document.removeEventListener("mousedown", onInteract); document.removeEventListener("keydown", onInteract); };
  }, []);

  // Focus trap for mobile menu
  useEffect(() => {
    if (!menuOpen) return;
    const menuEl = menuRef.current;
    const focusable = menuEl?.querySelectorAll<HTMLElement>('a, button, [tabindex]:not([tabindex="-1"])');
    if (focusable?.length) focusable[0].focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMenuOpen(false); return; }
      if (e.key !== "Tab" || !menuEl || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    setSearchOpen(false);
    setQuery("");
  };

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const navClass = (to: string, end = false) =>
    `px-4 py-2 rounded-full text-sm font-medium transition-colors ${isActive(to, end) ? "bg-ink-strong text-white" : "text-ink hover:bg-white"}`;
  const mobileNavClass = (to: string, end = false) =>
    `px-5 py-3.5 rounded-xl text-base font-medium transition-colors no-underline ${isActive(to, end) ? "bg-gold-soft text-gold-dark" : "text-ink hover:bg-bg-soft"}`;

  if (!usesSiteChrome(pathname)) return null;

  return (
    <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className={`pointer-events-auto w-full max-w-[1280px] flex items-center justify-between h-[64px] pl-5 pr-3 rounded-full transition-all duration-500 ${scrolled ? "aw-glass-pill shadow-elevated" : "bg-white/70 backdrop-blur-xl border border-white/60 shadow-soft"}`}>
        <Link href="/" className="flex-shrink-0" onClick={closeMenu}>
          <Logo />
        </Link>

        <nav className="hidden lg:flex items-center gap-1 bg-bg-soft/70 rounded-full p-1" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link key={link.to} href={link.to} className={navClass(link.to, link.to === "/")}>
              {link.label}
            </Link>
          ))}
          {user && isAdmin && (
            <Link href="/admin" className={navClass("/admin")}>
              Admin
            </Link>
          )}
          {user && !isAdmin && (isTeacher ? (
            <Link href="/teach" className={navClass("/teach")}>
              Teach
            </Link>
          ) : (
            <Link href="/my-learning" className={navClass("/my-learning")}>
              My Learning
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button className="w-10 h-10 rounded-full flex items-center justify-center text-ink-muted hover:bg-bg-soft hover:text-ink-strong transition-colors bg-transparent border-none cursor-pointer" aria-label="Search courses" onClick={() => setSearchOpen((s) => !s)}>
            <MagnifyingGlass size={16} weight="bold" />
          </button>

          {user ? (
            <>
              {!isTeacher && <div className="hidden sm:flex items-center gap-2" aria-label="Learning streak and XP">
                <span className="inline-flex items-center gap-1.5 bg-gold-soft text-gold-dark text-xs font-bold px-3 py-1.5 rounded-full" title={`${streak}-day streak`}>
                  <Fire size={14} weight="fill" /> {streak}
                </span>
                <span className="inline-flex items-center gap-1.5 bg-ink-strong text-white text-xs font-bold px-3 py-1.5 rounded-full" title={`${xp} XP earned`}>
                  <Diamond size={13} weight="fill" /> {xp}
                </span>
              </div>}
              <button className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:bg-bg-soft hover:text-ink-strong transition-colors bg-transparent border-none cursor-pointer relative" aria-label="Notifications">
                <Bell size={16} weight="bold" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red rounded-full" />
              </button>
              <div className="relative" ref={profileRef}>
                <button className="flex items-center gap-2 bg-transparent border-none cursor-pointer px-2 py-1 rounded-lg hover:bg-bg-soft transition-colors" onClick={() => setProfileOpen((o) => !o)} aria-expanded={profileOpen}>
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ background: user.avatarColor }}>{user.name.charAt(0).toUpperCase()}</span>
                  <span className="hidden sm:block text-sm font-medium text-ink-strong">{user.name.split(" ")[0]}</span>
                  <CaretDown size={13} className={`text-ink-muted transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white border-2 border-line rounded-xl shadow-elevated overflow-hidden z-50">
                    {isTeacher && (
                      <Link href="/teach" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-5 py-3 text-sm font-bold text-ink-strong hover:bg-bg-soft transition-colors no-underline"><Chalkboard size={15} weight="duotone" className="text-gold-dark" /> Teacher portal</Link>
                    )}
                    <Link href="/dashboard" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-5 py-3 text-sm text-ink hover:bg-bg-soft transition-colors no-underline"><House size={15} weight="duotone" className="text-gold-dark" /> Dashboard</Link>
                    <Link href="/my-learning" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-5 py-3 text-sm text-ink hover:bg-bg-soft transition-colors no-underline"><GraduationCap size={15} weight="duotone" className="text-gold-dark" /> My Learning</Link>
                    <Link href="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-5 py-3 text-sm text-ink hover:bg-bg-soft transition-colors no-underline"><User size={15} weight="duotone" className="text-gold-dark" /> Profile</Link>
                    <div className="border-t border-line" />
                    <button className="flex items-center gap-3 w-full px-5 py-3 text-sm text-red hover:bg-red-soft transition-colors bg-transparent border-none cursor-pointer text-left" onClick={() => { logout(); setProfileOpen(false); router.push("/"); }}>
                      <SignOut size={15} weight="duotone" /> Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="hidden lg:flex items-center gap-2">
              <Link href="/login" className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-xs font-bold text-ink-strong border border-line-strong hover:border-ink-strong transition-colors no-underline">Log In</Link>
              <Link href="/signup" className="inline-flex items-center bg-ink-strong text-white rounded-full px-5 py-2.5 text-xs font-bold border border-ink-strong hover:bg-black transition-colors no-underline">Sign Up</Link>
            </div>
          )}

          <button className="lg:hidden w-10 h-10 rounded-full flex items-center justify-center text-ink-muted hover:bg-bg-soft hover:text-ink-strong transition-colors bg-transparent border-none cursor-pointer" aria-label="Toggle menu" onClick={() => setMenuOpen((m) => !m)}>
            {menuOpen ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
          </button>
        </div>
      </div>

      {/* Search Panel */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="absolute top-[76px] left-4 right-4 mx-auto max-w-[1280px] bg-white/95 backdrop-blur-xl border border-line rounded-2xl shadow-elevated z-40 overflow-hidden pointer-events-auto"
          >
            <form onSubmit={submitSearch} className="max-w-[1280px] mx-auto px-6 py-4 flex items-center gap-3">
              <MagnifyingGlass size={16} className="text-ink-muted flex-shrink-0" />
              <input autoFocus type="text" placeholder="Search for courses, skills, or topics..." value={query} onChange={(e) => setQuery(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-sm text-ink-strong placeholder:text-ink-muted" />
              <button type="submit" className="bg-gold text-ink-strong font-bold text-xs tracking-widest uppercase px-5 py-2 rounded-[4px] border-2 border-gold hover:bg-gold-dark hover:border-gold-dark transition-all cursor-pointer">Search</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu — with focus trap */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-[76px] left-4 right-4 mx-auto max-w-[1280px] bg-white/95 backdrop-blur-xl border border-line rounded-2xl shadow-elevated z-40 lg:hidden overflow-y-auto pointer-events-auto max-h-[70dvh]"
          >
            <nav className="flex flex-col p-6 gap-1">
              {NAV_LINKS.map((link) => (
                <Link key={link.to} href={link.to} onClick={closeMenu} className={mobileNavClass(link.to, link.to === "/")}>
                  {link.label}
                </Link>
              ))}
              {user ? (
                <>
                  {isTeacher && <Link href="/teach" onClick={closeMenu} className={mobileNavClass("/teach")}>Teacher portal</Link>}
                  <Link href="/my-learning" onClick={closeMenu} className={mobileNavClass("/my-learning")}>My Learning</Link>
                  <Link href="/dashboard" onClick={closeMenu} className={mobileNavClass("/dashboard")}>Dashboard</Link>
                  <Link href="/profile" onClick={closeMenu} className={mobileNavClass("/profile")}>Profile</Link>
                  <button className="w-full text-left px-5 py-3.5 rounded-xl text-base font-medium text-red hover:bg-red-soft transition-colors bg-transparent border-none cursor-pointer mt-4" onClick={() => { logout(); closeMenu(); router.push("/"); }}>Log out</button>
                </>
              ) : (
                <div className="flex flex-col gap-3 mt-4">
                  <Link href="/login" className="w-full text-center border-2 border-line-strong rounded-[4px] bg-white px-5 py-3 text-xs font-bold text-ink-strong hover:border-gold transition-colors no-underline" onClick={closeMenu}>Log In</Link>
                  <Link href="/signup" className="w-full text-center bg-gold text-ink-strong rounded-[4px] px-5 py-3 text-xs font-bold border-2 border-gold hover:bg-gold-dark hover:border-gold-dark transition-colors no-underline" onClick={closeMenu}>Sign Up</Link>
                </div>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}