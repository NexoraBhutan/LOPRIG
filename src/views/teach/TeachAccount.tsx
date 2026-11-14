"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import Field from "@/components/teach/Field";
import { inputClass } from "@/lib/teach";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import ProfilePhotoPicker from "@/components/ProfilePhotoPicker";
import { Card, PageHeader } from "@/components/admin/ui";

const HEADLINE_MAX = 150;
const BIO_MAX = 600;

export default function TeachAccount() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex flex-col gap-6 max-w-[760px]">
      <PageHeader eyebrow="Settings" title="Account" description="How students see you, and your login details. Only you know your password; admins can't see it." />

      <Card title="Profile">
        <div className="mb-6 pb-6 border-b border-line">
          <ProfilePhotoPicker>
            <div className="min-w-0">
              <p className="font-display text-2xl font-semibold text-ink-strong tracking-tight">{user.name}</p>
              <p className="text-sm text-ink-muted break-all">{user.email}</p>
              <span className="inline-block mt-2 rounded-full bg-gold-soft px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-gold-dark">Teacher</span>
            </div>
          </ProfilePhotoPicker>
          <p className="text-xs text-ink-muted mt-5">Shown to your students on your courses. Signed in with Google? Your Google picture is used until you upload one.</p>
        </div>
        <ProfileForm key={`${user.name}|${user.headline}|${user.bio}`} />
      </Card>

      <Card title="Password" description="Choose a strong password that you don't use on any other website.">
        {user.hasPassword ? (
          <>
            <div role="status" className="flex gap-3 p-4 mb-6 rounded-xl bg-emerald-50 text-emerald-800 text-sm">
              <ShieldCheck size={22} weight="fill" className="text-emerald-600 shrink-0" />
              <p>You&apos;ve set your own password. You can change it again any time.</p>
            </div>
            <ChangePasswordForm />
          </>
        ) : (
          <p className="text-sm text-ink">
            You sign in with Google, so there&apos;s no password on this account. To be able to log in with your email
            too, <Link href="/forgot-password" className="font-bold text-gold-dark hover:text-gold">set a password</Link>.
          </p>
        )}
      </Card>
    </div>
  );
}

/** Name, headline and bio: what students see next to your courses. */
function ProfileForm() {
  const { user, updateProfile } = useAuth();
  const { push } = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [headline, setHeadline] = useState(user?.headline ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  if (!user) return null;

  const changed = name.trim() !== user.name || headline.trim() !== user.headline || bio.trim() !== user.bio;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Your name can't be empty.");
    setSaving(true);
    const res = await updateProfile({ name: name.trim(), headline: headline.trim(), bio: bio.trim() });
    setSaving(false);
    if (res.ok) {
      setError("");
      push("Profile saved. Students will see the new details on your courses.", "success");
    } else {
      setError(res.error);
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field id="teach-name" label="Name" error={error || undefined}>
          <input id="teach-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required autoComplete="name" className={inputClass} />
        </Field>
        <Field id="teach-email" label="Login email" hint="Ask an admin if this needs to change.">
          <input id="teach-email" value={user.email} readOnly className={`${inputClass.replace("bg-white", "bg-bg-soft")} text-ink-muted cursor-not-allowed`} />
        </Field>
      </div>
      <Field id="teach-headline" label="Headline" hint={`Shown under your name on every course, e.g. "Instructor of Gyalpozhing College". ${headline.length}/${HEADLINE_MAX}`}>
        <input id="teach-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={HEADLINE_MAX} placeholder="What you teach, or where" className={inputClass} />
      </Field>
      <Field id="teach-bio" label="About you" hint={`A few lines about your experience. ${bio.length}/${BIO_MAX}`}>
        <textarea id="teach-bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={BIO_MAX} rows={4} className={`${inputClass} resize-y`} />
      </Field>
      <div className="flex justify-end gap-3">
        {changed && (
          <button type="button" onClick={() => { setName(user.name); setHeadline(user.headline); setBio(user.bio); setError(""); }} className="btn btn-md btn-outline-neutral">
            Cancel
          </button>
        )}
        <button type="submit" disabled={!changed || saving} className="btn btn-md btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
