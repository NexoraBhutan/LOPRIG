"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import StatusBadge from "@/components/teach/StatusBadge";
import PageLoader from "@/components/PageLoader";
import { FilterChips, LoadMore, PageHeader, SearchBox, TableShell } from "@/components/admin/ui";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagedList } from "@/hooks/usePagedList";
import { formatMoney, timeAgo, type CourseStatus } from "@/lib/teach";
import type { AdminCourse } from "@/lib/admin";

type Filter = "ALL" | CourseStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING_REVIEW", label: "In review" },
  { value: "PUBLISHED", label: "Published" },
  { value: "REJECTED", label: "Needs changes" },
  { value: "DRAFT", label: "Drafts" },
];

export default function AdminCourses() {
  const params = useSearchParams();
  const [filter, setFilter] = useState<Filter>((params?.get("status") as Filter) || "ALL");
  const [search, setSearch] = useState("");
  const query = useDebounce(search, 300);
  const qs = new URLSearchParams();
  if (filter !== "ALL") qs.set("status", filter);
  if (query.trim()) qs.set("search", query.trim());
  const list = usePagedList<AdminCourse>(`/manage/courses/?${qs}`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Course review" title="Courses" description="Every course on Lop-rig. Open one to see its full content, then approve or send it back to the teacher." />
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <FilterChips label="Filter by status" options={FILTERS} value={filter} onChange={setFilter} />
        <SearchBox value={search} onChange={setSearch} placeholder="Search title or teacher" />
      </div>

      {list.loading ? <PageLoader /> : list.error ? <p role="alert" className="text-sm text-red-dark">{list.error}</p> : (
        <>
          <TableShell head={["Course", "Status", "Students", "Finished", "Price", "Updated"]} empty={list.items.length ? undefined : "No courses match."}>
            {list.items.map((c) => (
              <tr key={c.id} className="hover:bg-bg-soft/60 transition-colors">
                <td className="px-5 py-3.5">
                  <Link href={`/admin/courses/${c.id}`} className="group flex items-center gap-3 no-underline">
                    <span className="w-11 h-8 rounded-lg flex-shrink-0" style={{ background: `linear-gradient(135deg, ${c.gradient_start}, ${c.gradient_end})` }} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink-strong truncate max-w-[320px] group-hover:text-gold-dark">{c.title}</span>
                      <span className="block text-xs text-ink-muted">{c.teacher} · {c.category} · {c.lessons_count} lessons</span>
                    </span>
                  </Link>
                </td>
                <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
                <td className="px-5 py-3.5 tabular-nums">{c.enrolled}</td>
                <td className="px-5 py-3.5 tabular-nums text-ink-muted">{c.enrolled ? `${Math.round((100 * c.completed) / c.enrolled)}%` : "—"}</td>
                <td className="px-5 py-3.5 tabular-nums">{c.price ? formatMoney(c.price) : "Free"}</td>
                <td className="px-5 py-3.5 text-ink-muted whitespace-nowrap">{timeAgo(c.updated_at)}</td>
              </tr>
            ))}
          </TableShell>
          <LoadMore shown={list.items.length} total={list.count} hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
        </>
      )}
    </div>
  );
}
