"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Student, Chalkboard, BookOpen, GraduationCap, Trophy, Certificate, Coins, WarningCircle, ArrowRight, Receipt,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import PageLoader from "@/components/PageLoader";
import EmptyState from "@/components/EmptyState";
import { BarChart, Card, Pill } from "@/components/admin/ui";
import { api, errorMessage } from "@/lib/api";
import { PAYMENT_META, type AdminSummary } from "@/lib/admin";
import { STATUS_META, formatMoney, timeAgo, type CourseStatus } from "@/lib/teach";

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.05 } } };
const STATUS_ORDER: CourseStatus[] = ["PUBLISHED", "PENDING_REVIEW", "DRAFT", "REJECTED"];
const STATUS_BAR: Record<CourseStatus, string> = {
  PUBLISHED: "bg-emerald-500", PENDING_REVIEW: "bg-gold", DRAFT: "bg-line-strong", REJECTED: "bg-red",
};

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

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
  const kpis = [
    { label: "Students", value: t.students.toLocaleString(), hint: `+${t.students_30d} in 30 days`, icon: Student },
    { label: "Teachers", value: t.teachers.toLocaleString(), hint: `${t.admins} admin${t.admins === 1 ? "" : "s"}`, icon: Chalkboard },
    { label: "Published courses", value: t.courses.PUBLISHED, hint: `${t.courses.PENDING_REVIEW} awaiting review`, icon: BookOpen, accent: t.courses.PENDING_REVIEW > 0 },
    { label: "Enrollments", value: t.enrollments.toLocaleString(), hint: `+${t.enrollments_30d} in 30 days`, icon: GraduationCap },
    { label: "Completion rate", value: `${t.completion_rate}%`, hint: `${t.completions} course${t.completions === 1 ? "" : "s"} finished`, icon: Trophy },
    { label: "Certificates", value: t.certificates.toLocaleString(), hint: "Issued on completion", icon: Certificate },
    { label: "Revenue", value: formatMoney(t.revenue), hint: `${formatMoney(t.revenue_30d)} in 30 days`, icon: Coins },
    { label: "Failed payments", value: t.failed_payments_30d, hint: "In the last 30 days", icon: WarningCircle },
  ];
  const sum = (key: "signups" | "enrollments" | "revenue") => data.series.reduce((n, d) => n + d[key], 0);

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

      {t.payments_to_verify > 0 && (
        <motion.div variants={fadeUp}>
          <Link
            href="/admin/payments"
            className="flex flex-wrap items-center gap-4 p-5 rounded-2xl border-2 border-gold bg-gold-soft text-ink-strong no-underline hover:border-gold-dark transition-colors"
          >
            <span className="w-11 h-11 rounded-xl bg-gold text-ink-strong flex items-center justify-center flex-shrink-0">
              <Receipt size={22} weight="duotone" />
            </span>
            <span className="flex-1 min-w-[200px] text-sm">
              <strong className="block text-base font-semibold">
                {t.payments_to_verify === 1 ? "1 payment" : `${t.payments_to_verify} payments`} waiting for verification
              </strong>
              <span className="text-ink-muted">Students have paid and are waiting for their course to unlock. Check each one against the bank statement.</span>
            </span>
            <span className="btn btn-md btn-primary pointer-events-none">Verify payments <ArrowRight size={14} weight="bold" /></span>
          </Link>
        </motion.div>
      )}

      {data.pending_review.length > 0 && (
        <motion.div variants={fadeUp}>
          <Card title="Waiting for your review" description="Teachers are waiting. Approve to publish, or send it back with a note." action={<Link href="/admin/courses?status=PENDING_REVIEW" className="text-xs font-bold uppercase tracking-widest text-gold-dark no-underline">See all</Link>}>
            <ul className="divide-y divide-line">
              {data.pending_review.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/courses/${c.id}`} className="group flex items-center gap-4 py-3 no-underline">
                    <span className="w-12 h-9 rounded-lg flex-shrink-0" style={{ background: `linear-gradient(135deg, ${c.gradient_start}, ${c.gradient_end})` }} aria-hidden="true" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-ink-strong truncate group-hover:text-gold-dark">{c.title}</span>
                      <span className="block text-xs text-ink-muted">{c.teacher} · {c.lessons_count} lessons · submitted {timeAgo(c.updated_at)}</span>
                    </span>
                    <ArrowRight size={16} className="text-gold-dark" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </motion.div>
      )}

      <motion.div variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map(({ label, value, hint, icon: Icon, accent }) => (
          <motion.div key={label} variants={fadeUp} className={`border-2 rounded-2xl p-4 sm:p-5 min-w-0 transition-colors hover:border-gold ${accent ? "border-gold bg-gold-soft" : "border-line bg-white"}`}>
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${accent ? "bg-gold text-ink-strong" : "bg-gold-soft text-gold-dark"}`}>
              <Icon size={20} weight="duotone" />
            </span>
            <strong className="block font-display text-xl sm:text-2xl md:text-3xl font-semibold text-ink-strong tracking-tight [overflow-wrap:anywhere]">{value}</strong>
            <span className="block text-xs font-bold uppercase tracking-wider text-ink-muted [overflow-wrap:anywhere]">{label}</span>
            <span className="block text-xs text-ink-muted mt-1">{hint}</span>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="New students" description={`${sum("signups")} in the last 30 days`}>
          <BarChart summary={`Student sign-ups per day, ${sum("signups")} in 30 days`} data={data.series.map((d) => ({ label: shortDate(d.date), value: d.signups }))} />
        </Card>
        <Card title="Enrollments" description={`${sum("enrollments")} in the last 30 days`}>
          <BarChart summary={`Enrollments per day, ${sum("enrollments")} in 30 days`} data={data.series.map((d) => ({ label: shortDate(d.date), value: d.enrollments }))} />
        </Card>
        <Card title="Revenue" description={`${formatMoney(sum("revenue"))} in the last 30 days`}>
          <BarChart summary={`Revenue per day, ${formatMoney(sum("revenue"))} in 30 days`} format={formatMoney} data={data.series.map((d) => ({ label: shortDate(d.date), value: d.revenue }))} />
        </Card>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-5">
        <Card title="Top courses" description="Most enrolled, with how many students finish" action={<Link href="/admin/courses" className="text-xs font-bold uppercase tracking-widest text-gold-dark no-underline">All courses</Link>}>
          {data.top_courses.length ? (
            <ul className="flex flex-col gap-4">
              {data.top_courses.map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/courses/${c.id}`} className="group block no-underline">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-sm font-semibold text-ink-strong truncate group-hover:text-gold-dark">{c.title}</span>
                      <span className="text-xs text-ink-muted whitespace-nowrap"><strong className="text-ink-strong">{c.enrolled}</strong> enrolled · {c.completion_rate}% finish</span>
                    </div>
                    <div className="h-2 mt-2 rounded-full bg-bg-soft overflow-hidden" role="progressbar" aria-valuenow={c.completion_rate} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.title} completion rate`}>
                      <div className="h-full rounded-full bg-gold" style={{ width: `${c.completion_rate}%` }} />
                    </div>
                    <span className="text-xs text-ink-muted">{c.teacher}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-muted">No published courses yet.</p>}
        </Card>

        <Card title="Course status" description={`${totalCourses} courses in total`}>
          <div className="flex h-3 rounded-full overflow-hidden bg-bg-soft" role="img" aria-label={STATUS_ORDER.map((s) => `${STATUS_META[s].label}: ${t.courses[s]}`).join(", ")}>
            {STATUS_ORDER.map((s) => t.courses[s] > 0 && (
              <span key={s} className={STATUS_BAR[s]} style={{ width: `${(100 * t.courses[s]) / (totalCourses || 1)}%` }} />
            ))}
          </div>
          <ul className="grid grid-cols-2 gap-3 mt-5">
            {STATUS_ORDER.map((s) => (
              <li key={s}>
                <Link href={`/admin/courses?status=${s}`} className="flex items-center gap-2 text-sm no-underline text-ink hover:text-gold-dark">
                  <span className={`w-2.5 h-2.5 rounded-full ${STATUS_BAR[s]}`} aria-hidden="true" />
                  {STATUS_META[s].label}
                  <strong className="ml-auto text-ink-strong">{t.courses[s]}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </motion.div>

      <motion.div variants={fadeUp}>
        <Card title="Recent payments" description="Confirmed by the payment gateway" action={<Link href="/admin/payments" className="text-xs font-bold uppercase tracking-widest text-gold-dark no-underline">All payments</Link>}>
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
          ) : <p className="text-sm text-ink-muted">No payments yet.</p>}
        </Card>
      </motion.div>
    </motion.div>
  );
}
