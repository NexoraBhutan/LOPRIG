"use client";

import { useState } from "react";
import PageLoader from "@/components/PageLoader";
import { FilterChips, LoadMore, PageHeader, Pill, SearchBox, TableShell } from "@/components/admin/ui";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagedList } from "@/hooks/usePagedList";
import { PAYMENT_META, formatDate, type AdminPayment, type PaymentStatus } from "@/lib/admin";
import { formatMoney } from "@/lib/teach";

type Filter = "ALL" | PaymentStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SUCCEEDED", label: "Paid" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function AdminPayments() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const query = useDebounce(search, 300);
  const qs = new URLSearchParams();
  if (filter !== "ALL") qs.set("status", filter);
  if (query.trim()) qs.set("search", query.trim());
  const list = usePagedList<AdminPayment>(`/manage/payments/?${qs}`);
  const shownTotal = list.items.filter((p) => p.status === "SUCCEEDED").reduce((n, p) => n + p.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Money"
        title="Payments"
        description="Every checkout. A payment only counts as paid after the payment gateway confirms it."
        action={<p className="text-sm text-ink-muted self-start sm:self-auto">Paid in this list: <strong className="text-ink-strong">{formatMoney(shownTotal)}</strong></p>}
      />
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <FilterChips label="Filter by status" options={FILTERS} value={filter} onChange={setFilter} />
        <SearchBox value={search} onChange={setSearch} placeholder="Search reference, student or course" />
      </div>

      {list.loading ? <PageLoader /> : list.error ? <p role="alert" className="text-sm text-red-dark">{list.error}</p> : (
        <>
          <TableShell head={["Reference", "Student", "Course", "Amount", "Status", "Date"]} empty={list.items.length ? undefined : "No payments match."}>
            {list.items.map((p) => (
              <tr key={p.reference}>
                <td className="px-5 py-3.5 font-mono text-xs text-ink-muted">{p.reference}</td>
                <td className="px-5 py-3.5">
                  <span className="block font-semibold text-ink-strong">{p.student}</span>
                  <span className="block text-xs text-ink-muted">{p.student_email}</span>
                </td>
                <td className="px-5 py-3.5 text-ink">{p.course}</td>
                <td className="px-5 py-3.5 font-semibold tabular-nums whitespace-nowrap">{formatMoney(p.amount)}</td>
                <td className="px-5 py-3.5">
                  <Pill className={PAYMENT_META[p.status].className}>{PAYMENT_META[p.status].label}</Pill>
                  {p.failure_reason && <span className="block text-xs text-red-dark mt-1">{p.failure_reason}</span>}
                </td>
                <td className="px-5 py-3.5 text-ink-muted whitespace-nowrap">{formatDate(p.paid_at ?? p.created_at)}</td>
              </tr>
            ))}
          </TableShell>
          <LoadMore shown={list.items.length} total={list.count} hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
        </>
      )}
    </div>
  );
}
