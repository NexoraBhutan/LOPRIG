"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, BookOpen, Certificate, ChatCircleText, Checks, Clock, CreditCard, Exam, Info, PlayCircle,
  type Icon,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/teach";

type Kind = "ENROLLMENT" | "PAYMENT" | "COURSE_COMPLETED" | "QUIZ_REVIEW" | "COMMENT" | "REMINDER" | "SYSTEM";

interface AppNotification {
  id: number;
  kind: Kind;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

const POLL_MS = 60_000;

const KIND_STYLE: Record<Kind, { icon: Icon; tone: string }> = {
  ENROLLMENT: { icon: BookOpen, tone: "bg-sky-100 text-sky-700" },
  PAYMENT: { icon: CreditCard, tone: "bg-emerald-100 text-emerald-700" },
  COURSE_COMPLETED: { icon: Certificate, tone: "bg-gold-soft text-gold-dark" },
  QUIZ_REVIEW: { icon: Exam, tone: "bg-violet-100 text-violet-700" },
  COMMENT: { icon: ChatCircleText, tone: "bg-orange-100 text-orange-700" },
  REMINDER: { icon: PlayCircle, tone: "bg-red-soft text-red-dark" },
  SYSTEM: { icon: Info, tone: "bg-bg-sunken text-ink" },
};

/**
 * The bell for signed-in people: a red count of unread notifications, and a panel listing them.
 * Clicking one marks it read and opens the page it is about. The count refreshes every minute,
 * when the tab regains focus and on every page change.
 */
export default function NotificationBell({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    api<{ unread: number }>("/notifications/unread-count/").then((r) => setUnread(r.unread)).catch(() => undefined);
  }, []);

  const loadList = useCallback(() => {
    setFailed(false);
    api<{ results: AppNotification[] }>("/notifications/")
      .then((r) => setItems(r.results))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshCount();
    const timer = setInterval(refreshCount, POLL_MS);
    const onFocus = () => refreshCount();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, refreshCount, pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      loadList();
      refreshCount();
    }
  };

  const openItem = (n: AppNotification) => {
    if (!n.is_read) {
      setItems((list) => list?.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) ?? null);
      setUnread((u) => Math.max(0, u - 1));
      api(`/notifications/${n.id}/read/`, { method: "POST" }).catch(() => undefined);
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const markAll = () => {
    setItems((list) => list?.map((x) => ({ ...x, is_read: true })) ?? null);
    setUnread(0);
    api("/notifications/read-all/", { method: "POST" }).catch(refreshCount);
  };

  const shown = (items ?? []).filter((n) => filter === "all" || !n.is_read);
  const buttonTone = tone === "dark"
    ? "text-white/75 hover:text-white hover:bg-white/10"
    : "text-ink-muted hover:bg-bg-soft hover:text-ink-strong";

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative w-10 h-10 rounded-full flex items-center justify-center bg-transparent border-none cursor-pointer transition-colors ${buttonTone}`}
      >
        <Bell size={18} weight={unread ? "fill" : "bold"} />
        {unread > 0 && (
          <span className="absolute top-1 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red text-white text-[0.62rem] font-bold leading-[18px] text-center ring-2 ring-white tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-[84px] sm:top-full sm:mt-2 sm:w-[400px] max-h-[min(560px,75dvh)] flex flex-col bg-white border-2 border-line rounded-2xl shadow-elevated z-[60] overflow-hidden text-left"
        >
          <div className="px-5 pt-4 pb-3 border-b border-line">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink-strong">Notifications</h2>
              {unread > 0 && (
                <button type="button" onClick={markAll} className="inline-flex items-center gap-1 text-xs font-bold text-gold-dark hover:text-gold bg-transparent border-none cursor-pointer">
                  <Checks size={14} weight="bold" /> Mark all as read
                </button>
              )}
            </div>
            <div className="mt-3 flex gap-1.5" role="tablist" aria-label="Show">
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs font-bold border-none cursor-pointer transition-colors ${
                    filter === f ? "bg-ink-strong text-white" : "bg-bg-soft text-ink hover:bg-bg-sunken"
                  }`}
                >
                  {f === "all" ? "All" : `Unread${unread ? ` (${unread})` : ""}`}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto">
            {failed ? (
              <p className="px-5 py-10 text-center text-sm text-ink-muted">
                Couldn&apos;t load notifications.{" "}
                <button type="button" onClick={loadList} className="font-bold text-gold-dark bg-transparent border-none cursor-pointer">Try again</button>
              </p>
            ) : items === null ? (
              <p className="px-5 py-10 text-center text-sm text-ink-muted">Loading…</p>
            ) : shown.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <span className="mx-auto w-12 h-12 rounded-full bg-bg-soft flex items-center justify-center text-ink-muted">
                  <Bell size={22} />
                </span>
                <p className="mt-3 text-sm font-semibold text-ink-strong">
                  {filter === "unread" ? "You're all caught up" : "No notifications yet"}
                </p>
                <p className="mt-1 text-xs text-ink-muted">{emptyHint(user.role)}</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {shown.map((n) => {
                  const { icon: KindIcon, tone: kindTone } = KIND_STYLE[n.kind] ?? KIND_STYLE.SYSTEM;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className={`w-full flex gap-3 px-5 py-3.5 text-left border-none cursor-pointer transition-colors ${
                          n.is_read ? "bg-white hover:bg-bg-soft" : "bg-gold-soft/35 hover:bg-gold-soft/60"
                        }`}
                      >
                        <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${kindTone}`}>
                          <KindIcon size={17} weight="duotone" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={`block text-sm leading-snug ${n.is_read ? "text-ink" : "font-semibold text-ink-strong"}`}>{n.title}</span>
                          {n.message && <span className="block text-xs text-ink-muted mt-0.5 line-clamp-2 break-words">{n.message}</span>}
                          <span className="mt-1 inline-flex items-center gap-1 text-[0.7rem] text-ink-muted">
                            <Clock size={11} /> {timeAgo(n.created_at)}
                          </span>
                        </span>
                        {!n.is_read && <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-red flex-shrink-0" aria-label="Unread" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function emptyHint(role: string): string {
  if (role === "ADMIN") return "Courses waiting for review and payments to verify will show up here.";
  if (role === "TEACHER") return "New students, questions on your lessons and answers to mark will show up here.";
  return "Enrollments, payments, quiz feedback and reminders to keep learning will show up here.";
}
