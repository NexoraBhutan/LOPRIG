"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CaretDown, CaretLeft, CaretRight, CaretUp, Info, Plus, Trash } from "@phosphor-icons/react";
import PageLoader from "@/components/PageLoader";
import EmptyState from "@/components/EmptyState";
import { PageHeader, SearchBox } from "@/components/admin/ui";
import { useToast } from "@/context/ToastContext";
import { api, errorMessage } from "@/lib/api";
import { displayValue, type DataPage } from "@/lib/adminData";

const SEARCH_DELAY_MS = 300;

/**
 * One table: search, filter, sort, page through, select and delete; click a row to open it.
 * `embedded` drops the page heading so another page can show the table inside it, and
 * `fixedFilters` (e.g. one teacher's lessons) are always applied and not shown as dropdowns.
 */
export default function AdminDataTable({ table: tableSlug, embedded = false, fixedFilters }: {
  table?: string;
  embedded?: boolean;
  fixedFilters?: Record<string, string>;
} = {}) {
  const params = useParams<{ table: string }>();
  const slug = tableSlug ?? params?.table ?? "";
  const fixedKey = JSON.stringify(fixedFilters ?? {});
  const { push } = useToast();
  const [data, setData] = useState<DataPage | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [ordering, setOrdering] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  // Search as you type, after a short pause.
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ page: String(page) });
    if (search) qs.set("q", search);
    if (ordering) qs.set("ordering", ordering);
    Object.entries({ ...filters, ...JSON.parse(fixedKey) }).forEach(([k, v]) => v && qs.set(`f_${k}`, String(v)));
    return api<DataPage>(`/manage/data/${slug}/?${qs}`)
      .then((d) => { setData(d); setError(""); setSelected(new Set()); })
      .catch((err) => setError(errorMessage(err)));
  }, [slug, page, search, ordering, filters, fixedKey]);

  useEffect(() => { load(); }, [load]);

  if (error && !data) return <EmptyState title="Couldn't load this table" description={error} ctaLabel="Dashboard" ctaTo="/admin" />;
  if (!data) return <PageLoader />;

  const { table, results } = data;
  const shownFilters = table.filters.filter((f) => !fixedFilters?.[f.name]);
  const allOnPage = results.length > 0 && results.every((r) => selected.has(r.id));

  const sortBy = (name: string) => {
    setOrdering((o) => (o === name ? `-${name}` : o === `-${name}` ? "" : name));
    setPage(1);
  };

  const toggle = (id: number) =>
    setSelected((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const deleteSelected = async () => {
    const ids = [...selected];
    if (!window.confirm(`Delete ${ids.length} ${ids.length === 1 ? table.singular : table.label.toLowerCase()}? This can't be undone.`)) return;
    setBusy(true);
    try {
      const res = await api<{ deleted: number; failed: { label: string; reason: string }[] }>(
        `/manage/data/${slug}/bulk-delete/`, { method: "POST", body: { ids } },
      );
      if (res.deleted) push(`Deleted ${res.deleted}.`, "success");
      res.failed.forEach((f) => push(`“${f.label}”: ${f.reason}`, "error"));
      await load();
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {!embedded && <PageHeader
        eyebrow={table.group}
        title={table.label}
        description={`${data.count.toLocaleString()} ${data.count === 1 ? "record" : "records"}`}
        action={table.can_add ? (
          <Link href={`/admin/data/${slug}/new`} className="btn btn-md btn-primary no-underline inline-flex items-center gap-2">
            <Plus size={14} weight="bold" /> Add {table.singular}
          </Link>
        ) : undefined}
      />}

      {table.note && !embedded && (
        <p className="flex items-start gap-2 text-sm rounded-xl bg-gold-soft/60 px-4 py-3 text-ink">
          <Info size={18} weight="duotone" className="text-gold-dark flex-shrink-0 mt-0.5" /> {table.note}
        </p>
      )}

      {(table.searchable || shownFilters.length > 0) && (
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {table.searchable && <SearchBox value={query} onChange={setQuery} placeholder={`Search ${table.label.toLowerCase()}…`} />}
          <div className="flex flex-wrap gap-2">
            {shownFilters.map((f) => (
              <label key={f.name} className="relative">
                <span className="sr-only">{f.label}</span>
                <select
                  value={filters[f.name] ?? ""}
                  onChange={(e) => { setFilters((cur) => ({ ...cur, [f.name]: e.target.value })); setPage(1); }}
                  className={`appearance-none pl-4 pr-9 py-2.5 rounded-full border-2 text-sm cursor-pointer bg-white transition-colors ${
                    filters[f.name] ? "border-gold text-ink-strong font-semibold" : "border-line text-ink"
                  }`}
                >
                  <option value="">{f.label}: all</option>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <CaretDown size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
              </label>
            ))}
          </div>
        </div>
      )}

      {embedded && (
        <p className="text-sm text-ink-muted">
          <strong className="text-ink-strong tabular-nums">{data.count.toLocaleString()}</strong> {data.count === 1 ? table.singular : table.label.toLowerCase()}
        </p>
      )}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-ink-strong text-white px-4 py-3">
          <span className="text-sm flex-1">{selected.size} selected</span>
          <button type="button" onClick={() => setSelected(new Set())} className="text-sm text-white/70 hover:text-white bg-transparent border-none cursor-pointer">Clear</button>
          <button type="button" onClick={deleteSelected} disabled={busy} className="btn btn-sm btn-danger inline-flex items-center gap-1.5 disabled:opacity-60">
            <Trash size={14} weight="bold" /> {busy ? "Deleting…" : "Delete selected"}
          </button>
        </div>
      )}

      <div className="bg-white border-2 border-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-bg-soft">
              <tr className="text-left text-[0.7rem] font-bold uppercase tracking-wider text-ink-muted">
                {table.can_delete && (
                  <th scope="col" className="w-10 pl-5 py-3">
                    <input
                      type="checkbox"
                      checked={allOnPage}
                      onChange={() => setSelected(allOnPage ? new Set() : new Set(results.map((r) => r.id)))}
                      aria-label="Select all on this page"
                      className="w-4 h-4 accent-gold cursor-pointer"
                    />
                  </th>
                )}
                {table.columns.map((c) => {
                  const sorted = ordering === c.name ? "asc" : ordering === `-${c.name}` ? "desc" : null;
                  return (
                    <th key={c.name} scope="col" aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined} className="px-5 py-3 whitespace-nowrap">
                      <button type="button" onClick={() => sortBy(c.name)} className="inline-flex items-center gap-1 uppercase tracking-wider font-bold text-ink-muted hover:text-ink-strong bg-transparent border-none cursor-pointer p-0">
                        {c.label}
                        {sorted === "asc" && <CaretUp size={11} weight="bold" />}
                        {sorted === "desc" && <CaretDown size={11} weight="bold" />}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {results.map((row) => (
                <tr key={row.id} className={`transition-colors ${selected.has(row.id) ? "bg-gold-soft/40" : "hover:bg-bg-soft/60"}`}>
                  {table.can_delete && (
                    <td className="pl-5 py-3">
                      <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={`Select ${row.label}`} className="w-4 h-4 accent-gold cursor-pointer" />
                    </td>
                  )}
                  {table.columns.map((c, i) => {
                    const text = displayValue(c, row.values[c.name]);
                    return (
                      <td key={c.name} className="px-5 py-3 max-w-[280px]">
                        {i === 0 ? (
                          <Link href={`/admin/data/${slug}/${row.id}`} className="font-semibold text-ink-strong hover:text-gold-dark no-underline line-clamp-2 break-words">
                            {text}
                          </Link>
                        ) : c.kind === "boolean" ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${row.values[c.name] ? "bg-emerald-50 text-emerald-700" : "bg-bg-sunken text-ink-muted"}`}>{text}</span>
                        ) : (
                          <span className="block truncate text-ink" title={text}>{text}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {results.length === 0 && (
          <p className="p-10 text-center text-sm text-ink-muted">
            {search || Object.values(filters).some(Boolean) ? "Nothing matches your search or filters." : `No ${table.label.toLowerCase()} yet.`}
          </p>
        )}
      </div>

      {data.pages > 1 && (
        <nav className="flex items-center justify-between gap-4 text-sm text-ink-muted" aria-label="Pages">
          <span className="tabular-nums">Page {data.page} of {data.pages}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((p) => p - 1)} disabled={data.page <= 1} className="btn btn-sm btn-outline-neutral inline-flex items-center gap-1 disabled:opacity-40">
              <CaretLeft size={12} weight="bold" /> Previous
            </button>
            <button type="button" onClick={() => setPage((p) => p + 1)} disabled={data.page >= data.pages} className="btn btn-sm btn-outline-neutral inline-flex items-center gap-1 disabled:opacity-40">
              Next <CaretRight size={12} weight="bold" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
