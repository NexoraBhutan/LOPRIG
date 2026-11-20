"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Student, Chalkboard, BookOpen, GraduationCap, Trophy, Certificate, Coins, WarningCircle, ArrowRight,
  TrendUp, Star, Lightning, CheckCircle, Hourglass,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import PageLoader from "@/components/PageLoader";
import EmptyState from "@/components/EmptyState";
import { Card, Pill } from "@/components/admin/ui";
import { api, errorMessage } from "@/lib/api";
import { PAYMENT_META, type AdminSummary } from "@/lib/admin";
import { STATUS_META, formatMoney, timeAgo, type CourseStatus } from "@/lib/teach";

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.05 } } };

// Chart colours: brand gold leads, the others tell series apart. Text stays in the ink tones.
const C = { gold: "#ffb606", goldDark: "#c88e00", orange: "#f97316", blue: "#3b82f6", cyan: "#06b6d4", green: "#10b981", red: "#ff6347", grey: "#dcdcdc", track: "#eaebec", muted: "#767676", ink: "#1a1a1a" };

const STATUS_ORDER: CourseStatus[] = ["PUBLISHED", "PENDING_REVIEW", "DRAFT", "REJECTED"];
const STATUS_COLOR: Record<CourseStatus, string> = { PUBLISHED: C.green, PENDING_REVIEW: C.gold, DRAFT: C.grey, REJECTED: C.red };

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0);
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
const seeAll = (href: string, label: string) => (
  <Link href={href} className="text-xs font-bold uppercase tracking-widest text-gold-dark no-underline whitespace-nowrap">{label}</Link>
);

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<AdminSummary>("/manage/summary/").then(setData).catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <EmptyState title="Couldn't load the dashboard" description={error} ctaLabel="Try again" ctaOnClick={() => location.reload()} />;
  if (!data) return <PageLoader />;

  const t = data.totals;
  const totalCourses = STATUS_ORDER.reduce((n, s) => n + t.courses[s], 0);
  const sum = (key: "signups" | "enrollments" | "revenue") => data.series.reduce((n, d) => n + d[key], 0);
  const days = data.series.length || 30;

  // Each ring shows one honest share, named under the number.
  const kpis = [
    { label: "Students", value: t.students.toLocaleString(), ring: pct(t.students_30d, t.students), color: C.orange, delta: `+${t.students_30d} in 30 days`, note: "joined this month", icon: Student },
    { label: "Teachers", value: t.teachers.toLocaleString(), ring: pct(t.teachers, t.students + t.teachers), color: C.cyan, delta: plural(t.admins, "admin"), note: "of all users", icon: Chalkboard },
    { label: "Published", value: t.courses.PUBLISHED.toLocaleString(), ring: pct(t.courses.PUBLISHED, totalCourses), color: C.green, delta: `${t.courses.PENDING_REVIEW} awaiting review`, note: "of courses live", icon: BookOpen, accent: t.courses.PENDING_REVIEW > 0 },
    { label: "Enrollments", value: t.enrollments.toLocaleString(), ring: pct(t.enrollments_30d, t.enrollments), color: C.blue, delta: `+${t.enrollments_30d} in 30 days`, note: "new this month", icon: GraduationCap },
    { label: "Completion", value: `${t.completion_rate}%`, ring: t.completion_rate, color: C.gold, delta: plural(t.completions, "course") + " finished", note: "of enrollments", icon: Trophy },
    { label: "Certificates", value: t.certificates.toLocaleString(), ring: pct(t.certificates, t.enrollments), color: C.cyan, delta: "Issued on completion", note: "per enrollment", icon: Certificate },
    { label: "Revenue", value: formatMoney(t.revenue), ring: pct(t.revenue_30d, t.revenue), color: C.orange, delta: `${formatMoney(t.revenue_30d)} in 30 days`, note: "earned this month", icon: Coins },
  ];

  const best = data.series.reduce<AdminSummary["series"][number] | undefined>((a, d) => (!a || d.revenue > a.revenue ? d : a), undefined);
  const topCourse = data.top_courses[0];
  const runRate = (sum("revenue") / days) * 30;
  const toDo = t.payments_to_verify + t.courses.PENDING_REVIEW + t.failed_payments_30d;

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="flex flex-col gap-8">
      <motion.section variants={fadeUp} className="relative overflow-hidden rounded-2xl bg-ink-strong text-white px-7 py-9 md:px-10 md:py-11 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        {/* Punakha Dzong behind a dark wash from the left, so the greeting stays easy to read. */}
        <Image
          src="/admin-hero-punakha.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 1180px, 100vw"
          className="object-cover object-[center_40%]"
        />
        {/* Phones stack the text over the whole photo, so they get an even wash; wider screens fade left to right. */}
        <div aria-hidden="true" className="absolute inset-0 bg-ink-strong/65 md:bg-transparent md:bg-gradient-to-r md:from-ink-strong/90 md:via-ink-strong/55 md:to-transparent" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink-strong/45 to-transparent" />
        <div className="relative">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-gold mb-3">Admin portal · Platform overview</p>
          <h1 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold leading-tight text-white">
            Kuzuzangpo, {user?.name.split(" ")[0]}
          </h1>
          <p className="text-white/65 mt-3 max-w-[560px]">
            {t.students.toLocaleString()} students, {t.teachers} teachers and {t.courses.PUBLISHED} published courses on Lop-rig.
          </p>
        </div>
        <Link href="/admin/courses?status=PENDING_REVIEW" className="relative btn btn-primary btn-lg self-start md:self-auto">
          Review courses{t.courses.PENDING_REVIEW ? ` (${t.courses.PENDING_REVIEW})` : ""}
        </Link>
      </motion.section>

      {/* KPI rings */}
      <motion.div variants={stagger} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-3 sm:gap-4">
        {kpis.map(({ label, value, ring, color, delta, note, icon: Icon, accent }) => (
          <motion.div key={label} variants={fadeUp} className={`border-2 rounded-2xl p-4 min-w-0 transition-colors hover:border-gold ${accent ? "border-gold bg-gold-soft" : "border-line bg-white"}`}>
            <p className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wider text-ink-muted mb-3 truncate">
              <Icon size={14} weight="duotone" className="text-gold-dark" /> {label}
            </p>
            <div className="flex items-center gap-3">
              <Ring value={ring} color={color} label={`${label}: ${ring}% ${note}`} />
              <strong className="block min-w-0 font-display text-lg sm:text-xl font-semibold tracking-tight text-ink-strong [overflow-wrap:anywhere] leading-tight">{value}</strong>
            </div>
            <span className="block text-xs text-ink mt-3 truncate">{delta}</span>
            <span className="block text-[0.7rem] text-ink-muted truncate">Ring: {note}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Top courses bars · course catalogue donut · weekly activity */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        <Card title="Top courses" description="Students enrolled, and the share who finish">
          {data.top_courses.length ? (
            <ul className="flex flex-col gap-3.5">
              {data.top_courses.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/courses/${c.id}`} className="group grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 no-underline">
                    <span className="text-xs font-semibold text-ink-strong truncate group-hover:text-gold-dark">{c.title}</span>
                    <span className="h-5 rounded-md bg-bg-soft overflow-hidden">
                      <span
                        className="flex items-center justify-end h-full pr-1.5 rounded-md bg-gradient-to-r from-gold-dark to-gold text-[0.6rem] font-bold text-ink-strong"
                        style={{ width: `${Math.max(14, (100 * c.enrolled) / (topCourse.enrolled || 1))}%` }}
                      >
                        {c.completion_rate}%
                      </span>
                    </span>
                    <span className="text-xs font-bold tabular-nums text-ink-strong">{c.enrolled}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <Empty>No published courses yet.</Empty>}
        </Card>

        <Card title="Course status" description={`${plural(totalCourses, "course")} in total`}>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Donut
              parts={STATUS_ORDER.map((s) => ({ value: t.courses[s], color: STATUS_COLOR[s] }))}
              center={`${pct(t.courses.PUBLISHED, totalCourses)}%`}
              caption="Live"
              label={STATUS_ORDER.map((s) => `${STATUS_META[s].label}: ${t.courses[s]}`).join(", ")}
            />
            <ul className="flex-1 w-full flex flex-col gap-2.5">
              {STATUS_ORDER.map((s) => (
                <li key={s}>
                  <Link href={`/admin/courses?status=${s}`} className="flex items-center gap-2.5 text-sm no-underline text-ink hover:text-gold-dark">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} aria-hidden="true" />
                    {STATUS_META[s].label}
                    <strong className="ml-auto tabular-nums text-ink-strong">{t.courses[s]}</strong>
                    <span className="w-10 text-right text-xs text-ink-muted tabular-nums">{pct(t.courses[s], totalCourses)}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card title="Weekly activity" description={`${sum("signups")} new students, ${sum("enrollments")} enrollments`} className="lg:col-span-2 xl:col-span-1">
          <WeeklyBars series={data.series} />
        </Card>
      </motion.div>

      {/* Course table · revenue trajectory · action centre */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 xl:grid-cols-[1.15fr_1.25fr_0.9fr] gap-5">
        <Card title="Course performance" description="Most enrolled courses" action={seeAll("/admin/courses", "All courses")}>
          {data.top_courses.length ? (
            <CourseTable courses={data.top_courses} enrollments={t.enrollments} completion={t.completion_rate} />
          ) : <Empty>No published courses yet.</Empty>}
        </Card>

        <Card title="Revenue" description={`${formatMoney(sum("revenue"))} in the last ${days} days`}>
          <RevenueLine series={data.series} />
        </Card>

        <Card title="Action centre" description={toDo ? `${plural(toDo, "item")} need you` : "Nothing needs you right now"}>
          <ul className="flex flex-col gap-2.5">
            <Alert
              href="/admin/payments"
              tone={t.payments_to_verify ? "warn" : "ok"}
              title={t.payments_to_verify ? `${plural(t.payments_to_verify, "payment")} to verify` : "No payments waiting"}
              body={t.payments_to_verify ? "Students are waiting for their course to unlock." : "Every bank payment has been checked."}
            />
            <Alert
              href="/admin/courses?status=PENDING_REVIEW"
              tone={t.courses.PENDING_REVIEW ? "warn" : "ok"}
              title={t.courses.PENDING_REVIEW ? `${plural(t.courses.PENDING_REVIEW, "course")} awaiting review` : "Review queue is clear"}
              body={t.courses.PENDING_REVIEW ? "Teachers are waiting to publish." : "No course is waiting on you."}
            />
            <Alert
              href="/admin/payments"
              tone={t.failed_payments_30d ? "bad" : "ok"}
              title={t.failed_payments_30d ? plural(t.failed_payments_30d, "failed payment") : "No failed payments"}
              body="In the last 30 days."
            />
          </ul>
          {data.pending_review.length > 0 && (
            <>
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-muted mt-5 mb-2">Waiting for review</p>
              <ul className="divide-y divide-line">
                {data.pending_review.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/courses/${c.id}`} className="group flex items-center gap-3 py-2 no-underline">
                      <span className="w-9 h-7 rounded-md flex-shrink-0" style={{ background: `linear-gradient(135deg, ${c.gradient_start}, ${c.gradient_end})` }} aria-hidden="true" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-semibold text-ink-strong truncate group-hover:text-gold-dark">{c.title}</span>
                        <span className="block text-[0.7rem] text-ink-muted truncate">{c.teacher} · {timeAgo(c.updated_at)}</span>
                      </span>
                      <ArrowRight size={14} className="text-gold-dark" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </motion.div>

      {/* Summary strip */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-px rounded-2xl overflow-hidden bg-line border-2 border-line">
        <Stat icon={Coins} label="30-day revenue" value={formatMoney(sum("revenue"))} note={`${formatMoney(t.revenue)} all time`} />
        <Stat icon={TrendUp} label="Monthly run rate" value={formatMoney(runRate)} note={`About ${formatMoney(sum("revenue") / days)} a day`} />
        <Stat icon={Star} label="Top course" value={topCourse?.title ?? "—"} note={topCourse ? `${topCourse.enrolled} enrolled · ${topCourse.teacher}` : "No enrollments yet"} />
        <Stat icon={Lightning} label="Best day" value={best?.revenue ? shortDate(best.date) : "—"} note={best?.revenue ? `${formatMoney(best.revenue)} earned` : "No sales yet"} />
        <Stat icon={GraduationCap} label="New learning" value={plural(sum("enrollments"), "enrollment")} note={plural(sum("signups"), "new student")} />
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card title="Recent payments" description="Confirmed by the payment gateway" action={seeAll("/admin/payments", "All payments")}>
          {data.recent_payments.length ? (
            <ul className="divide-y divide-line">
              {data.recent_payments.map((p) => (
                <li key={p.reference} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                  <span className="flex-1 min-w-[180px]"><strong className="text-ink-strong">{p.student}</strong> <span className="text-ink-muted">· {p.course}</span></span>
                  <Pill className={PAYMENT_META[p.status].className}>{PAYMENT_META[p.status].label}</Pill>
                  <strong className="tabular-nums text-ink-strong w-24 text-right">{formatMoney(p.amount)}</strong>
                  <span className="text-xs text-ink-muted w-24 text-right">{timeAgo(p.paid_at)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>No payments yet.</Empty>}
        </Card>
      </motion.div>
    </motion.div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-muted">{children}</p>;
}

function Ring({ value, color, label }: { value: number; color: string; label: string }) {
  const r = 22;
  const len = 2 * Math.PI * r;
  const v = Math.min(100, Math.max(0, value));
  return (
    <svg viewBox="0 0 56 56" className="w-14 h-14 flex-shrink-0" role="img" aria-label={label}>
      <circle cx="28" cy="28" r={r} fill="none" stroke={C.track} strokeWidth="6" />
      <circle
        cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${(len * v) / 100} ${len}`} transform="rotate(-90 28 28)"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text x="28" y="28" textAnchor="middle" dominantBaseline="central" fill={C.ink} fontSize="11" fontWeight="700">{v}%</text>
    </svg>
  );
}

function Donut({ parts, center, caption, label }: { parts: { value: number; color: string }[]; center: string; caption: string; label: string }) {
  const r = 38;
  const len = 2 * Math.PI * r;
  const total = parts.reduce((n, p) => n + p.value, 0);
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((n, p) => n + (len * p.value) / (total || 1), 0));
  return (
    <svg viewBox="0 0 100 100" className="w-40 h-40 flex-shrink-0" role="img" aria-label={label}>
      <circle cx="50" cy="50" r={r} fill="none" stroke={C.track} strokeWidth="14" />
      <g transform="rotate(-90 50 50)">
        {total > 0 && parts.map((p, i) => p.value > 0 && (
          <circle
            key={i} cx="50" cy="50" r={r} fill="none" stroke={p.color} strokeWidth="14"
            strokeDasharray={`${Math.max(0.5, (len * p.value) / total - (p.value === total ? 0 : 1.2))} ${len}`}
            strokeDashoffset={-starts[i]}
          />
        ))}
      </g>
      <text x="50" y="48" textAnchor="middle" dominantBaseline="central" fill={C.ink} fontSize="15" fontWeight="700">{center}</text>
      <text x="50" y="62" textAnchor="middle" fill={C.goldDark} fontSize="7" fontWeight="700" letterSpacing="1">{caption.toUpperCase()}</text>
    </svg>
  );
}

/** The daily points folded into weeks (oldest first), stacked as new students + enrollments. */
function WeeklyBars({ series }: { series: AdminSummary["series"] }) {
  const weeks: { label: string; signups: number; enrollments: number }[] = [];
  for (let end = series.length; end > 0; end -= 7) {
    const chunk = series.slice(Math.max(0, end - 7), end);
    weeks.unshift({
      label: shortDate(chunk[0].date),
      signups: chunk.reduce((n, d) => n + d.signups, 0),
      enrollments: chunk.reduce((n, d) => n + d.enrollments, 0),
    });
  }
  if (!weeks.length) return <Empty>No activity yet.</Empty>;
  const peak = Math.max(1, ...weeks.map((w) => w.signups + w.enrollments));
  return (
    <div>
      <div className="flex items-end gap-3 h-44" role="img" aria-label={weeks.map((w) => `Week of ${w.label}: ${w.signups} new students, ${w.enrollments} enrollments`).join("; ")}>
        {weeks.map((w) => {
          const total = w.signups + w.enrollments;
          return (
            <div key={w.label} className="flex-1 h-full flex flex-col justify-end items-center gap-1.5" title={`Week of ${w.label}: ${w.signups} new students, ${w.enrollments} enrollments`}>
              <span className="text-[0.7rem] font-bold text-ink-strong tabular-nums">{total}</span>
              <div className="w-full max-w-[3rem] flex flex-col rounded-md overflow-hidden bg-bg-soft" style={{ height: `${Math.max(3, (100 * total) / peak)}%` }}>
                <span className="block bg-gold" style={{ flexGrow: w.enrollments }} />
                <span className="block bg-ink-strong" style={{ flexGrow: w.signups }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-2">
        {weeks.map((w) => <span key={w.label} className="flex-1 text-center text-[0.65rem] text-ink-muted">{w.label}</span>)}
      </div>
      <div className="flex justify-center gap-5 mt-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gold" aria-hidden="true" /> Enrollments</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-ink-strong" aria-hidden="true" /> New students</span>
      </div>
    </div>
  );
}

function CourseTable({ courses, enrollments, completion }: { courses: AdminSummary["top_courses"]; enrollments: number; completion: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[400px]">
        <thead>
          <tr className="text-left text-[0.65rem] font-bold uppercase tracking-wider text-ink-muted">
            <th scope="col" className="px-1 pb-3">Course</th>
            <th scope="col" className="px-1 pb-3 text-right">Enrolled</th>
            <th scope="col" className="px-1 pb-3 text-right">Finish</th>
            <th scope="col" className="px-1 pb-3 text-right">Share</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {courses.map((c) => (
            <tr key={c.id}>
              <td className="px-1 py-2.5 max-w-0 w-full">
                <Link href={`/admin/courses/${c.id}`} className="block truncate no-underline text-ink-strong font-semibold hover:text-gold-dark">
                  {c.title}<span className="font-normal text-ink-muted"> · {c.teacher}</span>
                </Link>
              </td>
              <td className="px-1 py-2.5 text-right tabular-nums text-ink-strong">{c.enrolled}</td>
              <td className={`px-1 py-2.5 text-right tabular-nums font-semibold ${c.completion_rate >= 50 ? "text-emerald-700" : c.completion_rate > 0 ? "text-gold-dark" : "text-ink-muted"}`}>
                {c.completion_rate}%
              </td>
              <td className="px-1 py-2.5 text-right tabular-nums text-ink-muted">{pct(c.enrolled, enrollments)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line font-bold text-ink-strong">
            <td className="px-1 pt-3 text-xs uppercase tracking-wider">All courses</td>
            <td className="px-1 pt-3 text-right tabular-nums">{enrollments}</td>
            <td className="px-1 pt-3 text-right tabular-nums text-emerald-700">{completion}%</td>
            <td className="px-1 pt-3 text-right tabular-nums">100%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function RevenueLine({ series }: { series: AdminSummary["series"] }) {
  if (!series.length) return <Empty>No data yet.</Empty>;
  const W = 600, H = 230, L = 56, R = 14, T = 34, B = 26;
  const values = series.map((d) => d.revenue);
  const max = Math.max(...values);
  const top = max > 0 ? niceCeil(max) : 1;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, series.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const points = series.map((d, i) => `${x(i)},${y(d.revenue)}`).join(" ");
  const peak = values.indexOf(max);
  const every = Math.max(1, Math.ceil(series.length / 6));
  const badgeX = Math.min(W - R - 60, Math.max(L + 60, x(peak)));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Revenue per day; highest ${formatMoney(max)}`}>
        <defs>
          <linearGradient id="rev-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={C.gold} stopOpacity="0.4" />
            <stop offset="100%" stopColor={C.gold} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(f * top)} y2={y(f * top)} stroke={C.track} />
            <text x={L - 8} y={y(f * top)} textAnchor="end" dominantBaseline="central" fill={C.muted} fontSize="10">
              {max > 0 ? compact(f * top) : f ? "" : "0"}
            </text>
          </g>
        ))}
        {series.map((d, i) => i % every === 0 && (
          <text key={d.date} x={x(i)} y={H - 6} textAnchor="middle" fill={C.muted} fontSize="10">{shortDate(d.date)}</text>
        ))}
        <polygon points={`${x(0)},${y(0)} ${points} ${x(series.length - 1)},${y(0)}`} fill="url(#rev-fill)" />
        <polyline points={points} fill="none" stroke={C.goldDark} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((d, i) => d.revenue > 0 && i !== peak && (
          <circle key={d.date} cx={x(i)} cy={y(d.revenue)} r="3.5" fill="#fff" stroke={C.goldDark} strokeWidth="2">
            <title>{`${shortDate(d.date)}: ${formatMoney(d.revenue)}`}</title>
          </circle>
        ))}
        {max > 0 && (
          <g>
            <rect x={badgeX - 60} y={y(max) - 30} width="120" height="20" rx="5" fill={C.ink} />
            <text x={badgeX} y={y(max) - 20} textAnchor="middle" dominantBaseline="central" fill={C.gold} fontSize="10" fontWeight="800">
              PEAK {formatMoney(max).toUpperCase()}
            </text>
            <circle cx={x(peak)} cy={y(max)} r="6" fill={C.gold} stroke={C.ink} strokeWidth="2">
              <title>{`${shortDate(series[peak].date)}: ${formatMoney(max)}`}</title>
            </circle>
          </g>
        )}
      </svg>
      {max === 0 && <p className="text-xs text-ink-muted mt-1 text-center">No paid enrollments in this period yet.</p>}
    </div>
  );
}

function Alert({ href, tone, title, body }: { href: string; tone: "ok" | "warn" | "bad"; title: string; body: string }) {
  const style = {
    ok: { box: "border-emerald-200 bg-emerald-50", text: "text-emerald-700", Icon: CheckCircle },
    warn: { box: "border-gold bg-gold-soft", text: "text-gold-dark", Icon: Hourglass },
    bad: { box: "border-red/40 bg-red-soft", text: "text-red-dark", Icon: WarningCircle },
  }[tone];
  return (
    <li>
      <Link href={href} className={`flex items-start gap-2.5 rounded-xl border-2 p-3 no-underline hover:border-gold-dark transition-colors ${style.box}`}>
        <style.Icon size={18} weight="fill" className={`mt-0.5 flex-shrink-0 ${style.text}`} />
        <span className="min-w-0">
          <span className={`block text-sm font-bold ${style.text}`}>{title}</span>
          <span className="block text-xs text-ink-muted mt-0.5">{body}</span>
        </span>
      </Link>
    </li>
  );
}

function Stat({ icon: Icon, label, value, note }: { icon: typeof Coins; label: string; value: string; note: string }) {
  return (
    <div className="flex items-center gap-3 bg-white p-4 min-w-0">
      <span className="w-10 h-10 rounded-xl bg-gold-soft text-gold-dark flex items-center justify-center flex-shrink-0">
        <Icon size={20} weight="duotone" />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.65rem] font-bold uppercase tracking-wider text-ink-muted">{label}</span>
        <strong className="block text-sm font-bold text-ink-strong truncate">{value}</strong>
        <span className="block text-xs text-ink-muted truncate">{note}</span>
      </span>
    </div>
  );
}

/** Round an axis maximum up to 1, 2 or 5 × a power of ten. */
function niceCeil(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

function compact(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : String(Math.round(v));
}
