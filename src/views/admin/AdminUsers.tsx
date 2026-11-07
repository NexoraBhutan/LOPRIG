"use client";

import { useState } from "react";
import { EnvelopeSimple, PaperPlaneTilt, UserPlus, X } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import PageLoader from "@/components/PageLoader";
import Field from "@/components/teach/Field";
import { Avatar, Card, FilterChips, LoadMore, PageHeader, Pill, SearchBox, TableShell } from "@/components/admin/ui";
import { useDebounce } from "@/hooks/useDebounce";
import { usePagedList } from "@/hooks/usePagedList";
import { api, errorMessage } from "@/lib/api";
import { ROLE_META, formatDate, type AdminUser } from "@/lib/admin";
import { fieldErrors, inputClass, timeAgo } from "@/lib/teach";
import type { UserRole } from "@/types";

type Filter = "ALL" | UserRole;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Everyone" },
  { value: "STUDENT", label: "Students" },
  { value: "TEACHER", label: "Teachers" },
  { value: "ADMIN", label: "Admins" },
];
const EMPTY_FORM = { name: "", email: "", role: "TEACHER" as UserRole, headline: "" };

function PasswordStatus({ u }: { u: AdminUser }) {
  if (u.must_change_password) {
    return (
      <span className="flex flex-col items-start gap-1">
        <Pill className="bg-gold-soft text-gold-dark">Temporary</Pill>
        <span className="text-xs text-ink-muted whitespace-nowrap">Not changed yet</span>
      </span>
    );
  }
  return (
    <span className="flex flex-col items-start gap-1">
      <Pill className="bg-emerald-50 text-emerald-700">Own password</Pill>
      <span className="text-xs text-ink-muted whitespace-nowrap">
        {u.password_changed_at ? `Changed ${timeAgo(u.password_changed_at)}` : "Set at sign-up"}
      </span>
    </span>
  );
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const { push } = useToast();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const query = useDebounce(search, 300);
  const qs = new URLSearchParams();
  if (filter !== "ALL") qs.set("role", filter);
  if (query.trim()) qs.set("search", query.trim());
  const list = usePagedList<AdminUser>(`/manage/users/?${qs}`);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      const created = await api<AdminUser>("/manage/users/", { method: "POST", body: form });
      if (created.email_sent) {
        push(`Account created. Login details were emailed to ${created.email}.`, "success");
      } else {
        push(`Account created, but the email to ${created.email} couldn't be sent. Check the email settings, then use “Email new login”.`, "error");
      }
      setForm(EMPTY_FORM);
      setAdding(false);
      list.reload();
    } catch (err) {
      setErrors(fieldErrors(err));
      push(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const updateUser = async (u: AdminUser, changes: Partial<Pick<AdminUser, "role" | "is_active">>, message: string) => {
    try {
      const updated = await api<AdminUser>(`/manage/users/${u.id}/`, { method: "PATCH", body: changes });
      list.update((row) => row.id === u.id, updated);
      push(message, "success");
    } catch (err) {
      push(errorMessage(err), "error");
    }
  };

  const emailNewLogin = async (u: AdminUser) => {
    if (!window.confirm(`Email ${u.name} new login details? Their current password stops working, they're signed out everywhere, and they'll set a new password after logging in.`)) return;
    try {
      const updated = await api<AdminUser>(`/manage/users/${u.id}/reset-password/`, { method: "POST" });
      list.update((row) => row.id === u.id, updated);
      push(updated.email_sent ? `New login details emailed to ${updated.email}.` : `Couldn't send the email to ${updated.email}. Try again later.`,
        updated.email_sent ? "success" : "error");
    } catch (err) {
      push(errorMessage(err), "error");
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="People"
        title="Users & teachers"
        description="Students sign up themselves. Create teacher and admin accounts here, change roles, or deactivate an account."
        action={
          <button onClick={() => setAdding((a) => !a)} className="btn btn-md btn-primary self-start">
            {adding ? <><X size={15} weight="bold" /> Close</> : <><UserPlus size={15} weight="bold" /> Add teacher</>}
          </button>
        }
      />

      {adding && (
        <Card title="New account" description="No password needed. We email them a temporary password; after logging in they must set their own from the teacher portal.">
          <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-2 gap-5" noValidate>
            <Field id="new-name" label="Full name" error={errors.name}>
              <input id="new-name" value={form.name} onChange={set("name")} className={inputClass} required />
            </Field>
            <Field id="new-email" label="Email" error={errors.email}>
              <input id="new-email" type="email" value={form.email} onChange={set("email")} className={inputClass} required />
            </Field>
            <Field id="new-role" label="Role" error={errors.role}>
              <select id="new-role" value={form.role} onChange={set("role")} className={inputClass}>
                <option value="TEACHER">Teacher</option>
                <option value="ADMIN">Admin</option>
                <option value="STUDENT">Student</option>
              </select>
            </Field>
            <Field id="new-headline" label="Title (optional)" hint="Shown under a teacher's name, e.g. “Senior Developer, Thimphu”.">
              <input id="new-headline" value={form.headline} onChange={set("headline")} className={inputClass} />
            </Field>
            <p className="md:col-span-2 flex items-start gap-2.5 text-sm text-ink-muted bg-bg-soft rounded-xl px-4 py-3">
              <EnvelopeSimple size={18} className="text-gold-dark shrink-0 mt-0.5" />
              Login details go straight to this email address. Nobody else, including you, sees the password.
            </p>
            <div className="flex items-end">
              <button type="submit" disabled={saving} className="btn btn-md btn-primary disabled:opacity-60">
                {saving ? "Creating…" : "Create account"}
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <FilterChips label="Filter by role" options={FILTERS} value={filter} onChange={setFilter} />
        <SearchBox value={search} onChange={setSearch} placeholder="Search name or email" />
      </div>

      {list.loading ? <PageLoader /> : list.error ? <p role="alert" className="text-sm text-red-dark">{list.error}</p> : (
        <>
          <TableShell head={["Person", "Role", "Activity", "Password", "Last login", "Account"]} empty={list.items.length ? undefined : "Nobody matches."}>
            {list.items.map((u) => {
              const self = String(u.id) === me?.id;
              return (
                <tr key={u.id} className={u.is_active ? "" : "opacity-60"}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} color={u.avatar_color} src={u.avatar} />
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink-strong truncate">{u.name}{self && <span className="text-ink-muted font-normal"> (you)</span>}</span>
                        <span className="block text-xs text-ink-muted truncate">{u.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <label className="sr-only" htmlFor={`role-${u.id}`}>Role for {u.name}</label>
                    <select
                      id={`role-${u.id}`}
                      value={u.role}
                      disabled={self}
                      onChange={(e) => {
                        const role = e.target.value as UserRole;
                        if (window.confirm(`Make ${u.name} ${ROLE_META[role].label.toLowerCase()}?`)) {
                          updateUser(u, { role }, `${u.name} is now ${ROLE_META[role].label.toLowerCase()}.`);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border-none cursor-pointer disabled:cursor-not-allowed ${ROLE_META[u.role].className}`}
                    >
                      {(Object.keys(ROLE_META) as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3.5 text-ink-muted whitespace-nowrap">
                    {u.role === "TEACHER" ? `${u.courses} course${u.courses === 1 ? "" : "s"}` : u.role === "STUDENT" ? `${u.enrollments} enrolled` : "—"}
                  </td>
                  <td className="px-5 py-3.5"><PasswordStatus u={u} /></td>
                  <td className="px-5 py-3.5 text-ink-muted whitespace-nowrap">
                    {u.last_login ? timeAgo(u.last_login) : "Never"}
                    <span className="block text-xs">Joined {formatDate(u.date_joined)}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    {self ? <Pill className="bg-emerald-50 text-emerald-700">Active</Pill> : (
                      <div className="flex flex-col items-stretch gap-1.5 w-max">
                      <button
                        onClick={() => {
                          const verb = u.is_active ? "Deactivate" : "Reactivate";
                          if (window.confirm(`${verb} ${u.name}? ${u.is_active ? "They won't be able to log in." : ""}`)) {
                            updateUser(u, { is_active: !u.is_active }, `${u.name} ${u.is_active ? "deactivated" : "reactivated"}.`);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 border-solid cursor-pointer transition-colors ${
                          u.is_active ? "border-line text-ink hover:border-red hover:text-red-dark bg-white" : "border-emerald-200 text-emerald-700 bg-emerald-50 hover:border-emerald-500"
                        }`}
                      >
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                      {u.is_active && (
                        <button
                          onClick={() => emailNewLogin(u)}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 border-solid border-line text-ink bg-white hover:border-gold hover:text-gold-dark cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <PaperPlaneTilt size={13} weight="bold" /> Email new login
                        </button>
                      )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </TableShell>
          <LoadMore shown={list.items.length} total={list.count} hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
        </>
      )}
    </div>
  );
}
