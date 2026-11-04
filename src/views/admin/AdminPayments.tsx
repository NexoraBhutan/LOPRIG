"use client";

import { useState } from "react";
import { Image as ImageIcon } from "@phosphor-icons/react";
import PageLoader from "@/components/PageLoader";
import { FilterChips, LoadMore, PageHeader, Pill, SearchBox, TableShell } from "@/components/admin/ui";
import QrSettingsCard from "@/components/admin/QrSettingsCard";
import PaymentReview from "@/components/admin/PaymentReview";
import { useSiteConfig } from "@/lib/siteConfig";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagedList } from "@/hooks/usePagedList";
import { PAYMENT_META, formatDate, type AdminPayment, type PaymentStatus } from "@/lib/admin";
import { formatMoney } from "@/lib/teach";

type Filter = "ALL" | PaymentStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "PENDING", label: "To verify" },
  { value: "SUCCEEDED", label: "Paid" },
  { value: "FAILED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

export default function AdminPayments() {
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState<AdminPayment | null>(null);
  const query = useDebounce(search, 300);
  const qs = new URLSearchParams();
  if (filter !== "ALL") qs.set("status", filter);
  if (query.trim()) qs.set("search", query.trim());
  const list = usePagedList<AdminPayment>(`/manage/payments/?${qs}`);
  const config = useSiteConfig();
  const shownTotal = list.items.filter((p) => p.status === "SUCCEEDED").reduce((n, p) => n + p.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Money"
        title="Payments"
        description="Students pay by bank QR and send the journal number with a screenshot. Check each one against the bank statement, then approve to unlock the course."
        action={<p className="text-sm text-ink-muted self-start sm:self-auto">Paid in this list: <strong className="text-ink-strong">{formatMoney(shownTotal)}</strong></p>}
      />
      {config && !config.payments_enabled && (
        <p className="rounded-2xl bg-gold-soft/60 px-5 py-4 text-sm text-ink">
          <strong className="text-ink-strong">Payments are switched off.</strong> Every course is free to enroll. Turn them on with{" "}
          <code>PAYMENTS_ENABLED=True</code> in the backend settings.
        </p>
      )}

      <QrSettingsCard />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <FilterChips label="Filter by status" options={FILTERS} value={filter} onChange={setFilter} />
        <SearchBox value={search} onChange={setSearch} placeholder="Search journal no., phone, student or course" />
      </div>

      {list.loading ? <PageLoader /> : list.error ? <p role="alert" className="text-sm text-red-dark">{list.error}</p> : (
        <>
          <TableShell
            head={["Student", "Course", "Amount", "Journal no.", "Status", "Date", ""]}
            empty={list.items.length ? undefined : filter === "PENDING" ? "Nothing to verify. All caught up." : "No payments match."}
          >
            {list.items.map((p) => (
              <tr key={p.reference}>
                <td className="px-5 py-3.5">
                  <span className="block font-semibold text-ink-strong">{p.student}</span>
                  <span className="block text-xs text-ink-muted">{p.student_email}</span>
                  {p.contact_number && <span className="block text-xs text-ink-muted tabular-nums">{p.contact_number}</span>}
                </td>
                <td className="px-5 py-3.5 text-ink">{p.course}</td>
                <td className="px-5 py-3.5 font-semibold tabular-nums whitespace-nowrap">{formatMoney(p.amount)}</td>
                <td className="px-5 py-3.5 font-mono text-xs text-ink-strong whitespace-nowrap">
                  {p.journal_number || <span className="text-ink-muted">—</span>}
                  {p.has_proof && <ImageIcon size={13} className="inline ml-1.5 text-ink-muted" aria-label="Screenshot attached" />}
                </td>
                <td className="px-5 py-3.5">
                  <Pill className={PAYMENT_META[p.status].className}>{PAYMENT_META[p.status].label}</Pill>
                  {p.failure_reason && <span className="block text-xs text-red-dark mt-1 max-w-[220px]">{p.failure_reason}</span>}
                </td>
                <td className="px-5 py-3.5 text-ink-muted whitespace-nowrap">{formatDate(p.paid_at ?? p.created_at)}</td>
                <td className="px-5 py-3.5 text-right">
                  {p.provider === "qr" && (
                    <button
                      type="button"
                      onClick={() => setReviewing(p)}
                      className={`btn btn-sm ${p.status === "PENDING" ? "btn-primary" : "btn-outline-neutral"}`}
                    >
                      {p.status === "PENDING" ? "Review" : "View"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </TableShell>
          <LoadMore shown={list.items.length} total={list.count} hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
        </>
      )}

      {reviewing && (
        <PaymentReview
          payment={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
}
