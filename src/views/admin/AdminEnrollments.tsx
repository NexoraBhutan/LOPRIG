"use client";

import { useState } from "react";
import Link from "next/link";
import PageLoader from "@/components/PageLoader";
import ProgressBar from "@/components/ProgressBar";
import { FilterChips, LoadMore, PageHeader, Pill, SearchBox, TableShell } from "@/components/admin/ui";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagedList } from "@/hooks/usePagedList";
import { ENROLLMENT_META, formatDate, type AdminEnrollment, type EnrollmentStatus } from "@/lib/admin";

type Filter = "ALL" | EnrollmentStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Learning" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PENDING_PAYMENT", label: "Awaiting payment" },
];

export default function AdminEnrollments() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const query = useDebounce(search, 300);
  const qs = new URLSearchParams();
  if (filter !== "ALL") qs.set("status", filter);
  if (query.trim()) qs.set("search", query.trim());
  const list = usePagedList<AdminEnrollment>(`/manage/enrollments/?${qs}`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Learning" title="Enrollments" description="Who is learning what, and how far they have got." />
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <FilterChips label="Filter by status" options={FILTERS} value={filter} onChange={setFilter} />
        <SearchBox value={search} onChange={setSearch} placeholder="Search student or course" />
      </div>

      {list.loading ? <PageLoader /> : list.error ? <p role="alert" className="text-sm text-red-dark">{list.error}</p> : (
        <>
          <TableShell head={["Student", "Course", "Progress", "Status", "Enrolled"]} empty={list.items.length ? undefined : "No enrollments match."}>
            {list.items.map((e) => (
              <tr key={e.id}>
                <td className="px-5 py-3.5">
                  <span className="block font-semibold text-ink-strong">{e.student}</span>
                  <span className="block text-xs text-ink-muted">{e.student_email}</span>
                </td>
                <td className="px-5 py-3.5">
                  <Link href={`/admin/courses/${e.course_id}`} className="text-ink-strong hover:text-gold-dark no-underline">{e.course}</Link>
                </td>
                <td className="px-5 py-3.5 w-[24%]">
                  <div className="flex items-center gap-3">
                    <div className="flex-1"><ProgressBar value={e.progress} size="sm" label={false} /></div>
                    <span className="text-xs font-bold tabular-nums w-10 text-right">{e.progress}%</span>
                  </div>
                  <span className="text-xs text-ink-muted">{e.completed_lessons} of {e.total_lessons} lessons</span>
                </td>
                <td className="px-5 py-3.5"><Pill className={ENROLLMENT_META[e.status].className}>{ENROLLMENT_META[e.status].label}</Pill></td>
                <td className="px-5 py-3.5 text-ink-muted whitespace-nowrap">{formatDate(e.activated_at ?? e.created_at)}</td>
              </tr>
            ))}
          </TableShell>
          <LoadMore shown={list.items.length} total={list.count} hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
        </>
      )}
    </div>
  );
}
