"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Info, MagnifyingGlass, Trash, X } from "@phosphor-icons/react";
import PageLoader from "@/components/PageLoader";
import EmptyState from "@/components/EmptyState";
import { PageHeader } from "@/components/admin/ui";
import { useToast } from "@/context/ToastContext";
import { ApiError, api, errorMessage, mediaUrl } from "@/lib/api";
import { inputClass } from "@/lib/teach";
import { displayValue, type CellValue, type DataPage, type DataRow, type FieldMeta, type RelationValue, type TableMeta } from "@/lib/adminData";

type FormValue = string | boolean | RelationValue;

/** A form value for an input, from what the API returned. */
function toForm(field: FieldMeta, value: CellValue): FormValue {
  if (field.kind === "relation") return (value as RelationValue) ?? null;
  if (field.kind === "boolean") return Boolean(value);
  if (value === null || value === undefined) return "";
  if (field.kind === "json") return JSON.stringify(value, null, 2);
  if (field.kind === "datetime") {
    const d = new Date(value as string);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16); // what <input type="datetime-local"> shows
  }
  return String(value);
}

/** What to send to the API for a form value. Throws a message for invalid JSON. */
function toApi(field: FieldMeta, value: FormValue): unknown {
  if (field.kind === "relation") return (value as RelationValue)?.id ?? null;
  if (field.kind === "boolean") return Boolean(value);
  const text = String(value ?? "");
  if (field.kind === "json") {
    if (!text.trim()) return field.required ? [] : null;
    try { return JSON.parse(text); } catch { throw new Error("This isn't valid JSON."); }
  }
  if (field.kind === "datetime") return text ? new Date(text).toISOString() : null;
  return text;
}

/** View, edit, add or delete one record of any table. `/admin/data/<table>/new` adds one. */
export default function AdminDataRow() {
  const params = useParams<{ table: string; id: string }>();
  const slug = params?.table ?? "";
  const isNew = params?.id === "new";
  const router = useRouter();
  const { push } = useToast();
  const [table, setTable] = useState<TableMeta | null>(null);
  const [row, setRow] = useState<DataRow | null>(null);
  const [form, setForm] = useState<Record<string, FormValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const request = isNew
      ? api<DataPage>(`/manage/data/${slug}/?page=1`).then((d) => ({ table: d.table, row: null as DataRow | null }))
      : api<{ table: TableMeta; row: DataRow }>(`/manage/data/${slug}/${params?.id}/`);
    request
      .then(({ table: t, row: r }) => {
        setTable(t);
        setRow(r);
        setForm(Object.fromEntries(t.fields.map((f) => [f.name, toForm(f, r ? r.values[f.name] : f.kind === "boolean" ? false : null)])));
      })
      .catch((err) => setLoadError(errorMessage(err)));
  }, [slug, isNew, params?.id]);

  if (loadError) return <EmptyState title="Couldn't open this record" description={loadError} ctaLabel="Back" ctaTo={`/admin/data/${slug}`} />;
  if (!table) return <PageLoader />;

  const canSave = isNew ? table.can_add : table.can_edit;
  const editableFields = table.fields.filter((f) => f.editable);
  const set = (name: string, value: FormValue) => setForm((cur) => ({ ...cur, [name]: value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    const problems: Record<string, string> = {};
    for (const f of editableFields) {
      try { body[f.name] = toApi(f, form[f.name]); } catch (err) { problems[f.name] = (err as Error).message; }
    }
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setSaving(true);
    try {
      const saved = await api<DataRow>(
        isNew ? `/manage/data/${slug}/` : `/manage/data/${slug}/${row?.id}/`,
        { method: isNew ? "POST" : "PATCH", body },
      );
      push(isNew ? `${capitalize(table.singular)} added.` : "Changes saved.", "success");
      if (isNew) router.replace(`/admin/data/${slug}/${saved.id}`);
      else {
        setRow(saved);
        setForm(Object.fromEntries(table.fields.map((f) => [f.name, toForm(f, saved.values[f.name])])));
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && err.data && typeof err.data === "object") {
        const data = err.data as Record<string, string | string[]>;
        setErrors(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])));
        push(data.detail ? String(data.detail) : "Please fix the highlighted fields.", "error");
      } else {
        push(errorMessage(err), "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!row || !window.confirm(`Delete “${row.label}”? This can't be undone.`)) return;
    try {
      await api(`/manage/data/${slug}/${row.id}/`, { method: "DELETE" });
      push(`${capitalize(table.singular)} deleted.`, "success");
      router.replace(`/admin/data/${slug}`);
    } catch (err) {
      push(errorMessage(err), "error");
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[860px]">
      <Link href={`/admin/data/${slug}`} className="self-start inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink-strong no-underline">
        <ArrowLeft size={14} weight="bold" /> {table.label}
      </Link>

      <PageHeader eyebrow={table.label} title={isNew ? `Add ${table.singular}` : row?.label || capitalize(table.singular)} />

      {table.note && (
        <p className="flex items-start gap-2 text-sm rounded-xl bg-gold-soft/60 px-4 py-3 text-ink">
          <Info size={18} weight="duotone" className="text-gold-dark flex-shrink-0 mt-0.5" /> {table.note}
        </p>
      )}

      <form onSubmit={save} className="bg-white border-2 border-line rounded-2xl p-5 sm:p-7 flex flex-col gap-5" noValidate>
        {table.fields.filter((f) => !(isNew && !f.editable)).map((f) => (
          <FieldInput
            key={f.name}
            field={f}
            value={form[f.name]}
            readOnly={!canSave || !f.editable}
            error={errors[f.name]}
            onChange={(v) => set(f.name, v)}
            raw={row?.values[f.name]}
          />
        ))}

        {(canSave || (!isNew && table.can_delete)) && (
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-line">
            {canSave && (
              <button type="submit" disabled={saving} className="btn btn-md btn-primary disabled:opacity-60">
                {saving ? "Saving…" : isNew ? `Add ${table.singular}` : "Save changes"}
              </button>
            )}
            <Link href={`/admin/data/${slug}`} className="btn btn-md btn-outline-neutral no-underline">Cancel</Link>
            {!isNew && table.can_delete && (
              <button type="button" onClick={remove} className="ml-auto btn btn-md btn-danger inline-flex items-center gap-1.5">
                <Trash size={14} weight="bold" /> Delete
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

function FieldInput({
  field, value, readOnly, error, onChange, raw,
}: {
  field: FieldMeta;
  value: FormValue;
  readOnly: boolean;
  error?: string;
  onChange: (value: FormValue) => void;
  raw?: CellValue;
}) {
  const id = `field-${field.name}`;
  const label = (
    <span className="flex items-baseline gap-2">
      <span className="text-xs font-bold uppercase tracking-wider text-ink-strong">{field.label}</span>
      {field.required && !readOnly && <span className="text-xs text-red-dark">required</span>}
      {readOnly && <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-ink-muted">read only</span>}
    </span>
  );
  const help = field.help && <p className="text-xs text-ink-muted">{field.help}</p>;
  const err = error && <p role="alert" className="text-xs font-semibold text-red-dark">{error}</p>;
  const tone = error ? "!border-red-300" : "";

  if (readOnly) {
    let shown: React.ReactNode = displayValue(field, raw ?? null);
    if (field.kind === "file" && raw) {
      shown = <a href={mediaUrl(String(raw))} target="_blank" rel="noopener noreferrer" className="text-gold-dark font-semibold">Open file</a>;
    } else if (field.kind === "json" && raw) {
      shown = <pre className="text-xs whitespace-pre-wrap break-words m-0">{JSON.stringify(raw, null, 2)}</pre>;
    } else if (field.kind === "textarea") {
      shown = <span className="whitespace-pre-line">{shown}</span>;
    }
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <div className="rounded-xl bg-bg-soft px-4 py-2.5 text-sm text-ink break-words">{shown}</div>
        {help}
      </div>
    );
  }

  if (field.kind === "boolean") {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="inline-flex items-center gap-3 cursor-pointer">
          <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 accent-gold cursor-pointer" />
          <span className="text-sm font-semibold text-ink-strong">{field.label}</span>
        </label>
        {help}{err}
      </div>
    );
  }

  let control: React.ReactNode;
  const text = typeof value === "string" ? value : "";
  switch (field.kind) {
    case "textarea":
      control = <textarea id={id} rows={5} value={text} onChange={(e) => onChange(e.target.value)} className={`${inputClass} resize-y ${tone}`} />;
      break;
    case "json":
      control = <textarea id={id} rows={6} value={text} onChange={(e) => onChange(e.target.value)} spellCheck={false} className={`${inputClass} resize-y font-mono text-xs ${tone}`} />;
      break;
    case "choice":
      control = (
        <select id={id} value={text} onChange={(e) => onChange(e.target.value)} className={`${inputClass} ${tone}`}>
          {!field.required && <option value="">—</option>}
          {field.options?.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
        </select>
      );
      break;
    case "relation":
      control = <RelationPicker id={id} field={field} value={value as RelationValue} onChange={onChange} />;
      break;
    default: {
      const type = { integer: "number", decimal: "number", date: "date", datetime: "datetime-local", email: "email", url: "url" }[field.kind as string] ?? "text";
      control = (
        <input
          id={id}
          type={type}
          step={field.kind === "decimal" ? "0.01" : undefined}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} ${tone}`}
        />
      );
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id}>{label}</label>
      {control}
      {help}{err}
    </div>
  );
}

/** Pick a linked record by searching its table. */
function RelationPicker({ id, field, value, onChange }: {
  id: string;
  field: FieldMeta;
  value: RelationValue;
  onChange: (value: RelationValue) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<{ id: number; label: string }[]>([]);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !field.table) return;
    const timer = setTimeout(() => {
      api<{ id: number; label: string }[]>(`/manage/data/${field.table}/options/?q=${encodeURIComponent(query.trim())}`)
        .then(setOptions)
        .catch(() => setOptions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query, field.table]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!field.table) return <div className="rounded-xl bg-bg-soft px-4 py-2.5 text-sm text-ink">{value?.label ?? "—"}</div>;

  return (
    <div className="relative" ref={box}>
      {value && !open ? (
        <div className={`${inputClass} flex items-center gap-2`}>
          <button type="button" id={id} onClick={() => { setOpen(true); setQuery(""); }} className="flex-1 min-w-0 text-left truncate bg-transparent border-none cursor-pointer p-0 text-sm text-ink-strong">
            {value.label} <span className="text-ink-muted">#{value.id}</span>
          </button>
          {!field.required && (
            <button type="button" onClick={() => onChange(null)} aria-label={`Clear ${field.label}`} className="w-7 h-7 rounded-full flex items-center justify-center text-ink-muted hover:bg-bg-sunken bg-transparent border-none cursor-pointer">
              <X size={13} weight="bold" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <MagnifyingGlass size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          <input
            id={id}
            autoFocus={open}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            placeholder={`Search ${field.label.toLowerCase()}…`}
            className={`${inputClass} pl-10`}
          />
        </div>
      )}
      {open && (
        <ul className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border-2 border-line rounded-xl shadow-elevated">
          {options.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-muted">No matches.</li>
          ) : options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => { onChange(o); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm text-ink hover:bg-gold-soft bg-transparent border-none cursor-pointer"
              >
                {o.label} <span className="text-ink-muted">#{o.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
