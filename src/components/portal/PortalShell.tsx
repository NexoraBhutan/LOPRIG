"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowSquareOut, CaretDoubleLeft, CaretDoubleRight, MagnifyingGlass, SignOut, List, X, type Icon } from "@phosphor-icons/react";
import Logo from "@/components/Logo";
import FooterPhoto from "@/components/FooterPhoto";
import NotificationBell from "@/components/NotificationBell";
import UserAvatar from "@/components/UserAvatar";
import { useAuth } from "@/context/AuthContext";

export interface PortalNavItem {
  href: string;
  label: string;
  icon: Icon;
  /** Defaults to "exact match, or a sub-page of href". */
  match?: (pathname: string) => boolean;
  badge?: number;
  /** A full address outside the portal (e.g. Django Admin): opens in a new tab. */
  external?: boolean;
  /** Heading this item sits under (e.g. "Catalogue"); a new heading starts when it changes. */
  section?: string;
}

const COLLAPSED_KEY = "loprig_portal_sidebar_collapsed";

/** `dark`: ink sidebar (admin portal). `warm`: white sidebar with gold accents (teacher portal). */
export type PortalTheme = "dark" | "warm";

const THEMES = {
  dark: {
    sidebar: "bg-ink-strong text-white",
    logo: "light",
    iconButton: "text-white/60 hover:text-white hover:bg-white/10",
    label: "text-gold",
    section: "text-white/45",
    item: "text-white/75 hover:text-white hover:bg-white/10",
    subtle: "text-white/60 hover:text-white hover:bg-white/10",
    divider: "border-white/10",
    empty: "text-white/50",
    card: "bg-white/5 border border-white/10",
    cardLink: "text-white hover:bg-white/10",
    email: "text-white/50",
    logout: "text-white/80 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/15",
    mobileBar: "bg-ink-strong",
    mobileIcon: "text-white",
    bell: "dark",
    page: "bg-bg-soft",
    topBar: "bg-bg-soft/85 border-b border-line",
  },
  warm: {
    sidebar: "bg-white text-ink-strong border-r border-gold/15",
    logo: "dark",
    iconButton: "text-ink-muted hover:text-ink-strong hover:bg-gold-soft",
    label: "text-gold-dark",
    section: "text-ink-muted",
    item: "text-ink hover:text-ink-strong hover:bg-gold-soft",
    subtle: "text-ink hover:text-ink-strong hover:bg-gold-soft",
    divider: "border-gold/25",
    empty: "text-ink-muted",
    card: "bg-white/95 border border-gold/20 shadow-[0_10px_30px_rgba(200,142,0,0.18)] backdrop-blur",
    cardLink: "text-ink-strong hover:bg-gold-soft",
    email: "text-ink-muted",
    logout: "text-ink-strong bg-gold-soft hover:bg-gold/25 border border-gold/25",
    mobileBar: "bg-white border-b border-gold/20",
    mobileIcon: "text-ink-strong",
    bell: "light",
    page: "bg-[#fffdf8]",
    topBar: "bg-[#fffdf8]/85",
  },
} as const;

const WIDE = 264;
const SLIM = 84;

/**
 * Sidebar + content + footer frame shared by the teacher portal and the admin portal.
 * On desktop the sidebar can be collapsed to an icon rail (remembered in this browser);
 * on small screens it is a drawer opened from the top bar.
 */
export default function PortalShell({
  label,
  home,
  nav,
  backgroundImage,
  searchable = false,
  theme = "dark",
  children,
}: {
  label: string;
  home: string;
  nav: PortalNavItem[];
  /** Optional photo behind the whole sidebar (darkened). */
  backgroundImage?: string;
  /** Show a box above the menu that filters its items (handy for long menus). */
  searchable?: boolean;
  theme?: PortalTheme;
  children: React.ReactNode;
}) {
  const t = THEMES[theme];
  const pathname = usePathname() ?? home;
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const close = () => setOpen(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // Storage blocked: start expanded.
    }
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // Not remembered, but still works for this visit.
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (item: PortalNavItem) =>
    item.match ? item.match(pathname) : pathname === item.href || (item.href !== home && pathname.startsWith(`${item.href}/`));

  /** `slim`: icon rail (labels become tooltips). `drawer`: the mobile menu, with a close button. */
  const sidebar = (slim: boolean, drawer: boolean) => (
    <div className={`relative flex flex-col h-full overflow-hidden ${t.sidebar}`}>
      {backgroundImage && (
        <>
          <Image src={backgroundImage} alt="" fill sizes="280px" className="object-cover object-[45%_center] pointer-events-none" />
          {/* Darkened, most at the top where the menu is, so every label stays readable. */}
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-ink-strong/95 via-ink-strong/85 to-ink-strong/60 pointer-events-none" />
        </>
      )}
      {theme === "dark" && <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,rgba(255,182,6,0.18)_0%,transparent_55%)] pointer-events-none" />}
      <div className={`relative flex-shrink-0 pt-7 pb-6 flex items-center ${slim ? "flex-col gap-4 px-2" : "justify-between gap-2 px-6"}`}>
        <Link href={home} onClick={close} className="no-underline" aria-label={`${label} home`}>
          {slim ? (
            // Just the "LR" mark: the left part of the wordmark.
            <span className="block w-[46px] overflow-hidden"><Logo tone={t.logo} size="sm" /></span>
          ) : (
            <Logo tone={t.logo} />
          )}
        </Link>
        {drawer ? (
          <button onClick={close} className={`w-9 h-9 rounded-lg flex items-center justify-center bg-transparent border-none cursor-pointer ${t.iconButton}`} aria-label="Close menu">
            <X size={20} weight="bold" />
          </button>
        ) : (
          <button
            onClick={toggleCollapsed}
            className={`w-9 h-9 rounded-lg flex items-center justify-center bg-transparent border-none cursor-pointer transition-colors ${t.iconButton}`}
            aria-label={slim ? "Expand menu" : "Collapse menu"}
            aria-expanded={!slim}
            title={slim ? "Expand menu" : "Collapse menu"}
          >
            {slim ? <CaretDoubleRight size={18} weight="bold" /> : <CaretDoubleLeft size={18} weight="bold" />}
          </button>
        )}
      </div>
      {!slim && <p className={`relative px-6 mb-3 text-[0.65rem] font-bold uppercase tracking-[0.18em] ${t.label}`}>{label}</p>}

      {searchable && !slim && (
        <label className="relative mx-3 mb-3 block">
          <span className="sr-only">Search the menu</span>
          <MagnifyingGlass size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/45 pointer-events-none" />
          <input
            type="search"
            value={menuQuery}
            onChange={(e) => setMenuQuery(e.target.value)}
            placeholder="Search menu…"
            style={{ outline: "none" }}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/10 border border-white/10 text-sm text-white placeholder:text-white/45 focus:border-gold/70 focus:bg-white/15 transition-colors [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
      )}

      <nav className={`relative flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 pb-2 ${slim ? "px-2" : "px-3"}`} aria-label={label}>
        {(() => {
          const q = slim ? "" : menuQuery.trim().toLowerCase();
          const items = q ? nav.filter((i) => i.label.toLowerCase().includes(q)) : nav;
          if (!items.length) return <p className={`px-4 py-3 text-sm ${t.empty}`}>Nothing in the menu matches.</p>;
          return items.map((item, index) => {
            const active = isActive(item);
            const Icon = item.icon;
            const badgeTone = active ? "bg-ink-strong text-gold" : "bg-gold text-ink-strong";
            const newSection = item.section && item.section !== items[index - 1]?.section;
            return (
              <div key={item.href}>
                {newSection && (slim ? (
                  index > 0 && <div className={`my-2 mx-2 border-t ${t.divider}`} aria-hidden="true" />
                ) : (
                  <p className={`px-4 pb-1.5 text-[0.62rem] font-bold uppercase tracking-[0.16em] ${t.section} ${index > 0 ? "pt-4" : "pt-1"}`}>
                    {item.section}
                  </p>
                ))}
                <Link
                  href={item.href}
                  onClick={close}
                  {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  aria-current={active ? "page" : undefined}
                  aria-label={slim ? (item.badge ? `${item.label} (${item.badge})` : item.label) : undefined}
                  title={slim ? item.label : undefined}
                  className={`relative flex items-center gap-3 rounded-xl text-sm font-medium no-underline transition-colors ${
                    slim ? "justify-center h-11" : "px-4 py-2.5"
                  } ${active ? "bg-gold text-ink-strong shadow-[0_6px_16px_rgba(255,182,6,0.35)]" : t.item}`}
                >
                  <Icon size={slim ? 20 : 18} weight={active ? "fill" : "regular"} />
                  {!slim && <span className="flex-1">{item.label}</span>}
                  {item.badge ? (
                    <span
                      className={`rounded-full font-bold text-center ${badgeTone} ${
                        slim ? "absolute top-1 right-2 min-w-[18px] px-1 text-[0.6rem] leading-[18px]" : "min-w-[22px] px-1.5 py-0.5 text-[0.7rem]"
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              </div>
            );
          });
        })()}
        <div className={`my-3 border-t ${t.divider} ${slim ? "mx-2" : "mx-4"}`} />
        <Link
          href="/"
          aria-label={slim ? "View student site" : undefined}
          title={slim ? "View student site" : undefined}
          className={`flex items-center gap-3 rounded-xl text-sm ${t.subtle} no-underline transition-colors ${slim ? "justify-center h-11" : "px-4 py-2.5"}`}
        >
          <ArrowSquareOut size={18} /> {!slim && "View student site"}
        </Link>
      </nav>

      {user && (
        <div className={`relative flex-shrink-0 rounded-2xl ${t.card} ${slim ? "m-2 p-2 flex flex-col items-center gap-2" : "m-3 p-4"}`}>
          <Link
            href={user.role === "TEACHER" ? "/teach/account" : "/profile"}
            onClick={close}
            title={slim ? `${user.name}: your account` : "Your account and profile photo"}
            className={`relative flex items-center gap-3 rounded-xl no-underline transition-colors ${t.cardLink} ${slim ? "p-1" : "-m-1 p-1"}`}
          >
            <UserAvatar name={user.name} src={user.avatar} color="#ffb606" textColor="text-ink-strong" className="w-10 h-10 text-sm" />
            {!slim && (
              <span className="min-w-0">
                <span className="block text-sm font-semibold truncate">{user.name}</span>
                <span className={`block text-xs truncate ${t.email}`}>{user.email}</span>
              </span>
            )}
          </Link>
          <button
            onClick={async () => { await logout(); router.push("/"); }}
            aria-label={slim ? "Log out" : undefined}
            title={slim ? "Log out" : undefined}
            className={`relative flex items-center justify-center gap-2 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer ${t.logout} transition-colors ${
              slim ? "w-10 h-10" : "mt-4 w-full py-2.5"
            }`}
          >
            <SignOut size={14} weight="bold" /> {!slim && "Log out"}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className={`min-h-[100dvh] ${t.page}`} style={{ "--portal-sidebar": `${collapsed ? SLIM : WIDE}px` } as React.CSSProperties}>
      <aside className="hidden lg:block fixed inset-y-0 left-0 z-40 w-[var(--portal-sidebar)] transition-[width] duration-200">
        {sidebar(collapsed, false)}
      </aside>

      <div className={`lg:hidden sticky top-0 z-30 flex items-center justify-between px-5 h-16 ${t.mobileBar}`}>
        <Link href={home} className="no-underline"><Logo tone={t.logo} size="sm" /></Link>
        <div className="flex items-center gap-1">
          <NotificationBell tone={t.bell} />
          <button onClick={() => setOpen(true)} className={`w-10 h-10 flex items-center justify-center bg-transparent border-none cursor-pointer ${t.mobileIcon}`} aria-label="Open menu" aria-expanded={open}>
            <List size={22} weight="bold" />
          </button>
        </div>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button className="absolute inset-0 w-full bg-black/50 border-none cursor-pointer" aria-label="Close menu" onClick={close} />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-elevated">{sidebar(false, true)}</aside>
        </div>
      )}

      <div className="lg:pl-[var(--portal-sidebar)] transition-[padding] duration-200 flex flex-col min-h-[100dvh]">
        {/* Desktop: a slim bar with the notification bell, always in reach. */}
        <div className={`hidden lg:flex sticky top-0 z-30 h-16 items-center justify-end gap-3 px-12 backdrop-blur ${t.topBar}`}>
          {user && <span className="text-sm text-ink-muted">Signed in as <strong className="text-ink-strong font-semibold">{user.name}</strong></span>}
          <NotificationBell />
        </div>
        <main className="flex-1">
          <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-12 py-8 lg:py-10">{children}</div>
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
      <FooterPhoto />
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
