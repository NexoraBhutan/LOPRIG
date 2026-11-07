"use client";

import Link from "next/link";
import { ShieldCheck } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import ProfilePhotoPicker from "@/components/ProfilePhotoPicker";
import { Card, PageHeader } from "@/components/admin/ui";

export default function TeachAccount() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex flex-col gap-6 max-w-[760px]">
      <PageHeader eyebrow="Settings" title="Account" description="Your login details. Only you know your password; admins can't see it." />

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
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-ink-muted">Name</dt>
            <dd className="mt-1 font-semibold text-ink-strong">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wider text-ink-muted">Login email</dt>
            <dd className="mt-1 font-semibold text-ink-strong break-all">{user.email}</dd>
          </div>
        </dl>
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
