"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowSquareOut, CaretRight } from "@phosphor-icons/react";
import PageLoader from "@/components/PageLoader";
import EmptyState from "@/components/EmptyState";
import { PageHeader } from "@/components/admin/ui";
import { API_URL, api, errorMessage } from "@/lib/api";
import { tableIcon, type DataTables } from "@/lib/adminData";

const DJANGO_ADMIN_URL = `${new URL(API_URL).origin}/admin/`;

/** Every table on the platform, grouped like the Django admin's sidebar. */
export default function AdminData() {
  const [data, setData] = useState<DataTables | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DataTables>("/manage/data/").then(setData).catch((err) => setError(errorMessage(err)));
  }, []);

  if (error) return <EmptyState title="Couldn't load the tables" description={error} ctaLabel="Try again" ctaOnClick={() => location.reload()} />;
  if (!data) return <PageLoader />;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Admin portal"
        title="All data"
        description="Every table on Lop-rig, the same as the site administration. Search, filter, add, edit and delete records."
        action={
          <a href={DJANGO_ADMIN_URL} target="_blank" rel="noopener noreferrer" className="btn btn-md btn-outline-neutral no-underline inline-flex items-center gap-2">
            <ArrowSquareOut size={15} weight="bold" /> Open Django admin
          </a>
        }
      />

      {data.groups.map((group) => (
        <section key={group.name} aria-labelledby={`group-${group.name}`}>
          <h2 id={`group-${group.name}`} className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-ink-muted mb-3">{group.name}</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {group.tables.map((t) => {
              const Icon = tableIcon(t.icon);
              return (
                <li key={t.slug}>
                  <Link
                    href={`/admin/data/${t.slug}`}
                    className="group flex items-center gap-4 bg-white border-2 border-line rounded-2xl px-5 py-4 no-underline hover:border-gold transition-colors"
                  >
                    <span className="w-10 h-10 rounded-xl bg-gold-soft text-gold-dark flex items-center justify-center flex-shrink-0">
                      <Icon size={20} weight="duotone" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-ink-strong truncate group-hover:text-gold-dark transition-colors">{t.label}</span>
                      <span className="block text-xs text-ink-muted tabular-nums">{t.count.toLocaleString()} {t.count === 1 ? "record" : "records"}</span>
                    </span>
                    <CaretRight size={14} className="text-ink-muted flex-shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
