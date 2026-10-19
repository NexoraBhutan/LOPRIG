"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Pencil, Book, Trophy, Clock, Bell, Lock, Shield, SignOut } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { useEnrollment } from "@/context/EnrollmentContext";
import { useToast } from "@/context/ToastContext";
import StatCard from "@/components/StatCard";
import ProgressRing from "@/components/ProgressRing";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

export default function Profile() {
  const { user, updateProfile, logout } = useAuth();
  const { enrolledCourses, getProgress } = useEnrollment();
  const { push } = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user?.name || "", bio: user?.bio || "" });

  useEffect(() => {
    if (user) setForm({ name: user.name || "", bio: user.bio || "" });
  }, [user]);

  if (!user) return null;

  const completed = enrolledCourses.filter((c) => getProgress(c.id) === 100).length;
  const totalHours = enrolledCourses.reduce((sum, c) => sum + parseFloat(c.duration), 0);
  const overallCompletion = enrolledCourses.length
    ? Math.round(enrolledCourses.reduce((sum, c) => sum + getProgress(c.id), 0) / enrolledCourses.length)
    : 0;

  const save = () => {
    updateProfile(form);
    setEditing(false);
    push("Profile updated", "success");
  };

  return (
    <main className="overflow-x-hidden w-full max-w-full px-8 lg:px-16 pt-36 pb-32 md:pb-48 aw-gold-wash">
      <div className="max-w-[1280px] mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14"
        >
          <div>
            <h1 className="font-display text-3xl md:text-5xl tracking-tighter font-semibold text-ink-strong">Profile</h1>
            <p className="text-ink-muted text-lg mt-3">Manage your account and learning preferences.</p>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn btn-secondary self-start sm:self-auto">
              <Pencil size={14} weight="bold" /> Edit profile
            </button>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-10 items-start">
          {/* Avatar card */}
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp}
            className="bg-white border-2 border-line rounded-2xl p-8 text-center lg:sticky lg:top-32"
          >
            <div
              className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center text-white font-bold text-3xl"
              style={{ background: user.avatarColor }}
              aria-hidden="true"
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-xl font-semibold text-ink-strong">{user.name}</h2>
            <p className="text-sm text-ink-muted mt-1">{user.email}</p>
            <p className="text-xs text-ink-muted mt-4">
              Member since {new Date(user.joined).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>

            <div className="mt-8 pt-8 border-t border-line flex flex-col items-center gap-4">
              <ProgressRing value={overallCompletion} size={92} tone="brand" label={`${overallCompletion}% overall completion`} />
              <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Overall completion</span>
            </div>
          </motion.div>

          <div className="flex flex-col gap-10">
            {/* Stats */}
            <motion.div
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
              variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-3 gap-5"
            >
              <motion.div variants={fadeUp}><StatCard icon={Book} value={enrolledCourses.length} label="Courses" tone="green" /></motion.div>
              <motion.div variants={fadeUp}><StatCard icon={Trophy} value={completed} label="Completed" tone="gold" /></motion.div>
              <motion.div variants={fadeUp}><StatCard icon={Clock} value={`${totalHours ? totalHours.toFixed(0) : 0}h`} label="Learning time" tone="blue" /></motion.div>
            </motion.div>

            {/* Account info */}
            <motion.section
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              className="bg-white border-2 border-line rounded-2xl p-8"
            >
              <h3 className="text-lg font-semibold text-ink-strong mb-6">Account information</h3>

              {editing ? (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="profile-name" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Display name</label>
                    <input
                      id="profile-name"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-4 py-3.5 bg-bg-soft border-2 border-line rounded-xl text-sm text-ink-strong focus:border-gold focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="profile-bio" className="text-xs font-bold text-ink-strong uppercase tracking-wider">Bio</label>
                    <textarea
                      id="profile-bio"
                      rows={4}
                      value={form.bio}
                      onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                      className="w-full px-4 py-3.5 bg-bg-soft border-2 border-line rounded-xl text-sm text-ink-strong focus:border-gold focus:outline-none transition-colors resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={save} className="btn btn-primary">Save changes</button>
                    <button
                      onClick={() => { setForm({ name: user.name, bio: user.bio }); setEditing(false); }}
                      className="btn btn-outline"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Display name</span>
                    <span className="text-sm font-medium text-ink-strong">{user.name}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Email</span>
                    <span className="text-sm font-medium text-ink-strong">{user.email}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Bio</span>
                    <p className="text-sm text-ink-muted leading-relaxed">{user.bio || "No bio yet."}</p>
                  </div>
                </div>
              )}
            </motion.section>

            {/* Preferences */}
            <motion.section
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              className="bg-white border-2 border-line rounded-2xl p-8"
            >
              <h3 className="text-lg font-semibold text-ink-strong mb-6">Preferences</h3>
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-4">
                  <span className="w-10 h-10 rounded-xl bg-gold-soft text-gold-dark flex items-center justify-center flex-shrink-0">
                    <Bell size={18} weight="duotone" />
                  </span>
                  <div className="flex-1">
                    <span className="block text-sm font-semibold text-ink-strong">Email notifications</span>
                    <span className="text-xs text-ink-muted">Course updates and reminders</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <span className="w-11 h-6 bg-line-strong peer-checked:bg-gold rounded-full transition-colors" />
                    <span className="absolute left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-soft" />
                  </label>
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-10 h-10 rounded-xl bg-bg-sunken text-ink flex items-center justify-center flex-shrink-0">
                    <Lock size={18} weight="duotone" />
                  </span>
                  <div className="flex-1">
                    <span className="block text-sm font-semibold text-ink-strong">Two-factor authentication</span>
                    <span className="text-xs text-ink-muted">Add an extra layer of security</span>
                  </div>
                  <button className="btn btn-outline btn-sm">Enable</button>
                </div>
              </div>
            </motion.section>

            {/* Security */}
            <motion.section
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
              variants={fadeUp}
              className="bg-white border-2 border-line rounded-2xl p-8"
            >
              <h3 className="text-lg font-semibold text-ink-strong mb-6">Security</h3>
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-4">
                  <span className="w-10 h-10 rounded-xl bg-bg-sunken text-ink flex items-center justify-center flex-shrink-0">
                    <Lock size={18} weight="duotone" />
                  </span>
                  <div className="flex-1">
                    <span className="block text-sm font-semibold text-ink-strong">Password</span>
                    <span className="text-xs text-ink-muted">Last updated 3 months ago</span>
                  </div>
                  <button className="btn btn-outline btn-sm">Change</button>
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-10 h-10 rounded-xl bg-bg-sunken text-ink flex items-center justify-center flex-shrink-0">
                    <Shield size={18} weight="duotone" />
                  </span>
                  <div className="flex-1">
                    <span className="block text-sm font-semibold text-ink-strong">Active sessions</span>
                    <span className="text-xs text-ink-muted">1 session — this device</span>
                  </div>
                  <button className="btn btn-outline btn-sm">Manage</button>
                </div>
              </div>
            </motion.section>

            <motion.button
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp}
              onClick={() => { logout(); router.push("/"); }}
              className="self-start flex items-center gap-2 bg-transparent border-none cursor-pointer text-sm font-bold text-red hover:text-red-dark transition-colors"
            >
              <SignOut size={15} weight="bold" /> Log out of all devices
            </motion.button>
          </div>
        </div>
      </div>
    </main>
  );
}