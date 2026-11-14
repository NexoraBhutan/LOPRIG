"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Pencil, Book, Trophy, Clock, Lock, Shield, SignOut, Camera } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { useEnrollment } from "@/context/EnrollmentContext";
import { useToast } from "@/context/ToastContext";
import StatCard from "@/components/StatCard";
import ProgressRing from "@/components/ProgressRing";
import ViewableAvatar from "@/components/ViewableAvatar";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { durationToHours } from "@/lib/mappers";
import { api, errorMessage } from "@/lib/api";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const PHOTO_MAX_MB = 3;
const NAME_MAX = 150;
const BIO_MAX = 500;

const inputClass =
  "w-full px-4 py-3.5 bg-bg-soft border-2 border-line rounded-xl text-sm text-ink-strong focus:border-gold focus:outline-none transition-colors";

function formatDate(iso: string | null, opts: Intl.DateTimeFormatOptions) {
  return iso ? new Date(iso).toLocaleDateString("en-US", opts) : "";
}

export default function Profile() {
  const { user, updateProfile, refreshUser, logout, logoutEverywhere } = useAuth();
  const { enrolledCourses, getProgress } = useEnrollment();
  const { push } = useToast();
  const router = useRouter();

  // Nothing changes until "Save changes": the form and the photo are drafts while editing.
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", bio: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [photoPreview, setPhotoPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) return setPhotoPreview("");
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  if (!user) return null;

  const isStudent = user.role === "STUDENT";
  const completed = enrolledCourses.filter((c) => getProgress(c.id) === 100).length;
  const totalHours = enrolledCourses.reduce((sum, c) => sum + durationToHours(c.duration), 0);
  const overallCompletion = enrolledCourses.length
    ? Math.round(enrolledCourses.reduce((sum, c) => sum + getProgress(c.id), 0) / enrolledCourses.length)
    : 0;

  // A Google picture links to googleusercontent.com; an uploaded photo lives on our server.
  const hasOwnPhoto = Boolean(user.avatar) && !user.avatar.includes("googleusercontent.com");
  const googlePicture = hasOwnPhoto ? "" : user.avatar;
  const shownAvatar = photoPreview || (photoRemoved ? googlePicture : user.avatar);

  const name = form.name.trim();
  const bio = form.bio.trim();
  const textChanged = name !== user.name || bio !== (user.bio || "");
  const photoChanged = Boolean(photo) || photoRemoved;
  const dirty = textChanged || photoChanged;
  const canSave = dirty && name.length > 0 && !saving;

  const startEditing = () => {
    setForm({ name: user.name, bio: user.bio || "" });
    setPhoto(null);
    setPhotoRemoved(false);
    setEditing(true);
  };

  const cancel = () => {
    setPhoto(null);
    setPhotoRemoved(false);
    setEditing(false);
  };

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // choosing the same file again should still work
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return push("Please choose a PNG, JPG or WebP image.", "error");
    if (file.size > PHOTO_MAX_MB * 1024 * 1024) return push(`That photo is too large. The limit is ${PHOTO_MAX_MB} MB.`, "error");
    setPhoto(file);
    setPhotoRemoved(false);
  };

  const removePhoto = () => {
    if (photo) return setPhoto(null); // undo the photo picked in this edit
    setPhotoRemoved(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      if (textChanged) {
        const res = await updateProfile({ name, bio });
        if (!res.ok) throw new Error(res.error);
      }
      if (photo) {
        const body = new FormData();
        body.append("image", photo);
        await api("/users/me/avatar/", { method: "POST", body });
      } else if (photoRemoved) {
        await api("/users/me/avatar/", { method: "DELETE" });
      }
      if (photoChanged) await refreshUser();
      setPhoto(null);
      setPhotoRemoved(false);
      setEditing(false);
      push("Profile saved", "success");
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const signOutEverywhere = async () => {
    if (!window.confirm("Sign out of Lop-rig on every device, including this one?")) return;
    setSigningOutAll(true);
    const res = await logoutEverywhere();
    setSigningOutAll(false);
    if (!res.ok) return push(res.error, "error");
    push("You've been signed out on all devices.", "success");
    router.push("/login");
  };

  const passwordNote = !user.hasPassword
    ? "You sign in with Google. Set a password to also log in with your email."
    : user.passwordChangedAt
      ? `Last changed ${formatDate(user.passwordChangedAt, { day: "numeric", month: "long", year: "numeric" })}`
      : "Set when your account was created";

  return (
    <main className="overflow-x-hidden w-full max-w-full px-5 sm:px-8 lg:px-16 pt-36 pb-32 md:pb-48 aw-gold-wash">
      <div className="max-w-[1280px] mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14"
        >
          <div>
            <h1 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong">Profile</h1>
            <p className="text-ink-muted text-lg mt-3">
              {isStudent ? "Manage your account and learning preferences." : "Manage your account and how others see you."}
            </p>
          </div>
          {!editing && (
            <button type="button" onClick={startEditing} className="btn btn-md btn-secondary self-start sm:self-auto">
              <Pencil size={14} weight="bold" /> Edit profile
            </button>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-10 items-start">
          {/* Avatar card */}
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp}
            className={`bg-white border-2 rounded-2xl p-8 text-center lg:sticky lg:top-32 transition-colors ${editing ? "border-gold" : "border-line"}`}
          >
            <ViewableAvatar name={editing ? name || user.name : user.name} src={shownAvatar} color={user.avatarColor} className="w-36 h-36 text-5xl">
              {editing && (
                <button
                  type="button"
                  onClick={() => photoInput.current?.click()}
                  disabled={saving}
                  className="absolute bottom-1 right-1 w-11 h-11 rounded-full flex items-center justify-center bg-ink-strong text-gold border-[3px] border-white shadow-md hover:bg-black transition-colors cursor-pointer disabled:opacity-50"
                  aria-label={shownAvatar ? "Change photo" : "Add photo"}
                >
                  <Camera size={18} weight="fill" />
                </button>
              )}
            </ViewableAvatar>
            {!editing && shownAvatar && <p className="text-[0.7rem] text-ink-muted mt-2">Click your photo to see it full size</p>}

            {editing && (
              <div className="mt-4">
                <input ref={photoInput} type="file" accept={PHOTO_TYPES.join(",")} onChange={pickPhoto} className="sr-only" aria-label="Choose a profile photo" />
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => photoInput.current?.click()}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-strong bg-bg-soft border-2 border-line rounded-full px-3.5 py-1.5 hover:border-gold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Camera size={14} weight="bold" /> {shownAvatar ? "Change photo" : "Add photo"}
                  </button>
                  {(photo || (hasOwnPhoto && !photoRemoved)) && (
                    <button type="button" onClick={removePhoto} disabled={saving} className="text-xs font-bold text-ink-muted hover:text-red-600 bg-transparent border-none px-2 py-1.5 cursor-pointer disabled:opacity-50">
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[0.7rem] text-ink-muted mt-2">
                  {photo ? "New photo (not saved yet)" : photoRemoved ? "Photo will be removed when you save" : `PNG, JPG or WebP, up to ${PHOTO_MAX_MB} MB`}
                </p>
              </div>
            )}

            <h2 className="text-xl font-semibold text-ink-strong mt-6">{user.name}</h2>
            <p className="text-sm text-ink-muted mt-1 break-all">{user.email}</p>
            <p className="text-xs text-ink-muted mt-4">
              Member since {formatDate(user.joined, { month: "long", year: "numeric" })}
            </p>

            {isStudent && (
              <div className="mt-8 pt-8 border-t border-line flex flex-col items-center gap-4">
                <ProgressRing value={overallCompletion} size={92} tone="brand" label={`${overallCompletion}% overall completion`} />
                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Overall completion</span>
              </div>
            )}
          </motion.div>

          <div className="flex flex-col gap-10">
            {isStudent && (
              <motion.div
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                variants={stagger}
                className="grid grid-cols-1 sm:grid-cols-3 gap-5"
              >
                <motion.div variants={fadeUp}><StatCard icon={Book} value={enrolledCourses.length} label="Courses" tone="green" /></motion.div>
                <motion.div variants={fadeUp}><StatCard icon={Trophy} value={completed} label="Completed" tone="gold" /></motion.div>
                <motion.div variants={fadeUp}><StatCard icon={Clock} value={`${totalHours ? totalHours.toFixed(0) : 0}h`} label="Learning time" tone="blue" /></motion.div>
              </motion.div>
            )}

            {/* Account info */}
            <motion.section
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              className={`bg-white border-2 rounded-2xl p-8 transition-colors ${editing ? "border-gold" : "border-line"}`}
            >
              <h3 className="text-lg font-semibold text-ink-strong mb-6">Account information</h3>

              {editing ? (
                <form onSubmit={save} className="flex flex-col gap-5" noValidate>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="profile-name" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Display name</label>
                    <input
                      id="profile-name"
                      value={form.name}
                      maxLength={NAME_MAX}
                      autoFocus
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      aria-invalid={!name}
                      aria-describedby={!name ? "profile-name-error" : undefined}
                      className={inputClass}
                    />
                    {!name && <p id="profile-name-error" role="alert" className="text-xs text-red-dark">Your name can&apos;t be empty.</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Email</span>
                    <span className="text-sm font-medium text-ink-strong break-all">{user.email}</span>
                    <span className="text-xs text-ink-muted">Your login email can&apos;t be changed here.</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="profile-bio" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Bio</label>
                      <span className="text-xs text-ink-muted tabular-nums">{form.bio.length}/{BIO_MAX}</span>
                    </div>
                    <textarea
                      id="profile-bio"
                      rows={4}
                      value={form.bio}
                      maxLength={BIO_MAX}
                      placeholder="A line or two about you"
                      onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button type="submit" disabled={!canSave} className="btn btn-md btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                    <button type="button" onClick={cancel} disabled={saving} className="btn btn-md btn-outline-neutral disabled:opacity-50">
                      Cancel
                    </button>
                    {!dirty && <span className="text-xs text-ink-muted">No changes yet</span>}
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Display name</span>
                    <span className="text-sm font-medium text-ink-strong">{user.name}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Email</span>
                    <span className="text-sm font-medium text-ink-strong break-all">{user.email}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Bio</span>
                    <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-line">{user.bio || "No bio yet."}</p>
                  </div>
                </div>
              )}
            </motion.section>

            {/* Security */}
            <motion.section
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              className="bg-white border-2 border-line rounded-2xl p-8"
            >
              <h3 className="text-lg font-semibold text-ink-strong mb-6">Security</h3>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="w-10 h-10 rounded-xl bg-bg-sunken text-ink flex items-center justify-center flex-shrink-0">
                      <Lock size={18} weight="duotone" />
                    </span>
                    <div className="flex-1 min-w-[180px]">
                      <span className="block text-sm font-semibold text-ink-strong">Password</span>
                      <span className="text-xs text-ink-muted">{passwordNote}</span>
                    </div>
                    {user.hasPassword ? (
                      !changingPassword && (
                        <button type="button" onClick={() => setChangingPassword(true)} className="btn btn-sm btn-outline-neutral">
                          Change
                        </button>
                      )
                    ) : (
                      <Link href="/forgot-password" className="btn btn-sm btn-outline-neutral no-underline">Set a password</Link>
                    )}
                  </div>
                  {changingPassword && (
                    <div className="sm:pl-14">
                      <ChangePasswordForm onDone={() => setChangingPassword(false)} onCancel={() => setChangingPassword(false)} />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-line">
                  <span className="w-10 h-10 rounded-xl bg-bg-sunken text-ink flex items-center justify-center flex-shrink-0">
                    <Shield size={18} weight="duotone" />
                  </span>
                  <div className="flex-1 min-w-[180px]">
                    <span className="block text-sm font-semibold text-ink-strong">Signed-in devices</span>
                    <span className="text-xs text-ink-muted">Lost a phone or used a shared computer? Sign out everywhere.</span>
                  </div>
                  <button type="button" onClick={signOutEverywhere} disabled={signingOutAll} className="btn btn-sm btn-danger disabled:opacity-50 disabled:cursor-wait">
                    {signingOutAll ? "Signing out…" : "Sign out of all devices"}
                  </button>
                </div>
              </div>
            </motion.section>

            <button
              type="button"
              onClick={async () => { await logout(); router.push("/"); }}
              className="self-start flex items-center gap-2 bg-transparent border-none cursor-pointer text-sm font-bold text-red hover:text-red-dark transition-colors"
            >
              <SignOut size={15} weight="bold" /> Log out
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
