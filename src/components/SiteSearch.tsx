"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useCatalog } from "@/context/CatalogContext";
import { CoverArt } from "@/components/CourseThumb";

const MAX_SUGGESTIONS = 6;

/**
 * The navbar search: one clean field that suggests matching courses as you type (arrow keys
 * + Enter work), shows topics to browse when empty, and opens the full results page on Enter.
 */
export default function SiteSearch({ onClose }: { onClose: () => void }) {
  const { courses, categories } = useCatalog();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    return courses
      .filter((c) => [c.title, c.instructor?.name, c.category, c.description].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => Number(b.title.toLowerCase().includes(q)) - Number(a.title.toLowerCase().includes(q)))
      .slice(0, MAX_SUGGESTIONS);
  }, [courses, q]);

  const go = (href: string) => {
    router.push(href);
    onClose();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (active >= 0 && matches[active]) return go(`/courses/${matches[active].id}`);
    if (q) go(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!matches.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
    }
  };

  return (
    <div className="p-3 sm:p-4">
      <form onSubmit={submit} role="search" className="flex items-center gap-2 sm:gap-3">
        <label className="flex-1 min-w-0 flex items-center gap-3 h-12 px-4 rounded-full bg-bg-soft border-2 border-transparent focus-within:border-gold focus-within:bg-white transition-colors">
          <MagnifyingGlass size={18} weight="bold" className="text-ink-muted flex-shrink-0" />
          <span className="sr-only">Search courses</span>
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(-1); }}
            onKeyDown={onKeyDown}
            placeholder="Search courses, skills or teachers…"
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls="search-suggestions"
            aria-activedescendant={active >= 0 ? `search-option-${active}` : undefined}
            // The field's rounded box shows focus, so skip the site-wide focus outline here.
            style={{ outline: "none" }}
            className="flex-1 min-w-0 bg-transparent border-none text-[15px] text-ink-strong placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(""); input.current?.focus(); }} className="w-7 h-7 rounded-full flex items-center justify-center text-ink-muted hover:bg-bg-sunken bg-transparent border-none cursor-pointer" aria-label="Clear search">
              <X size={14} weight="bold" />
            </button>
          )}
        </label>
        <button type="submit" disabled={!q} className="hidden sm:inline-flex btn btn-md btn-primary rounded-full disabled:opacity-50">
          Search
        </button>
        <button type="button" onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center text-ink-muted hover:bg-bg-soft hover:text-ink-strong bg-transparent border-none cursor-pointer flex-shrink-0" aria-label="Close search">
          <X size={18} weight="bold" />
        </button>
      </form>

      {q ? (
        <div className="mt-3">
          {matches.length > 0 ? (
            <ul id="search-suggestions" role="listbox" aria-label="Matching courses" className="flex flex-col gap-1">
              {matches.map((c, i) => (
                <li key={c.id} id={`search-option-${i}`} role="option" aria-selected={active === i}>
                  <Link
                    href={`/courses/${c.id}`}
                    onClick={onClose}
                    onMouseEnter={() => setActive(i)}
                    className={`flex items-center gap-3 p-2 rounded-xl no-underline transition-colors ${active === i ? "bg-gold-soft" : "hover:bg-bg-soft"}`}
                  >
                    <CoverArt src={c.thumbnail} gradient={c.gradient} iconSize={0} className="w-16 h-10 rounded-lg flex-shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-ink-strong truncate"><Highlight text={c.title} query={q} /></span>
                      <span className="block text-xs text-ink-muted truncate">
                        {c.instructor?.name} · {c.lessonsCount} lessons · {c.price === 0 ? "Free" : `Nu. ${(c.discountPrice || c.price).toLocaleString()}`}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-4 text-sm text-ink-muted">No courses match “{query.trim()}” yet. Try a shorter word.</p>
          )}
          <button
            type="button"
            onClick={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}
            className="mt-2 w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-gold-dark hover:bg-gold-soft/60 bg-transparent border-none cursor-pointer text-left"
          >
            See all results for “{query.trim()}” <ArrowRight size={15} weight="bold" />
          </button>
        </div>
      ) : (
        categories.length > 0 && (
          <div className="mt-4 px-1">
            <p className="text-[0.7rem] font-bold uppercase tracking-widest text-ink-muted mb-2">Browse topics</p>
            <div className="flex flex-wrap gap-2">
              {categories.slice(0, 8).map((cat) => (
                <Link key={cat.id} href={`/categories/${cat.id}`} onClick={onClose} className="px-3.5 py-1.5 rounded-full bg-white border border-line-strong text-sm text-ink hover:border-gold hover:bg-gold-soft hover:text-gold-dark no-underline transition-colors">
                  {cat.title}
                </Link>
              ))}
              <Link href="/courses" onClick={onClose} className="px-3.5 py-1.5 rounded-full bg-ink-strong text-white text-sm font-semibold no-underline hover:bg-black transition-colors">
                All courses
              </Link>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const i = text.toLowerCase().indexOf(query);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-gold-soft text-ink-strong rounded-sm">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}
