import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Pencil, Book, Trophy, Clock, Bell, Lock, Shield, SignOut } from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import { useEnrollment } from "../context/EnrollmentContext";
import { useToast } from "../context/ToastContext";
import StatCard from "../components/StatCard";
import ProgressRing from "../components/ProgressRing";

const fadeUp = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } };
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

export default function Profile() {
  const { user, updateProfile, logout } = useAuth();
  const { enrolledCourses, getProgress } = useEnrollment();
  const { push } = useToast();
  const navigate = useNavigate();
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

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col sm:flex-row items-start gap-6 mb-16 p-8 md:p-10 bg-white border-2 border-line rounded-3xl overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(120deg,var(--gold-soft)_0%,transparent_60%)]" aria-hidden="true" />
          <span className="relative w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0" style={{ background: user.avatarColor }}>
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div className="flex-1 relative">
            {editing ? (
              <input className="w-full text-2xl font-semibold text-ink-strong bg-transparent border-b-2 border-gold outline-none pb-1 mb-2" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            ) : (
              <h1 className="text-2xl md:text-3xl tracking-tight font-semibold text-ink-strong mb-1">{user.name}</h1>
            )}
            <p className="text-sm text-ink-muted mb-3">{user.email}</p>
            {editing ? (
              <textarea className="w-full text-sm text-ink bg-bg-soft border-2 border-line rounded-lg p-3 outline-none focus:border-gold transition-colors resize-none" rows={2} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
            ) : (
              <p className="text-sm text-ink-muted">{user.bio}</p>
            )}
          </div>
          {editing ? (
            <button className="btn btn-primary btn-sm relative" onClick={save}>Save changes</button>
          ) : (
            <button className="btn btn-outline-neutral btn-sm relative" onClick={() => setEditing(true)}>
              <Pencil size={13} /> Edit Profile
            </button>
          )}
        </motion.div>

        {/* Stats */}
        <h2 className="text-lg font-semibold text-ink-strong mb-6">Your learning</h2>
        <motion.div
          initial="hidden" animate="visible"
          variants={stagger}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16"
        >
          <motion.div variants={fadeUp}><StatCard icon={Book} value={enrolledCourses.length} label="Courses Enrolled" tone="green" /></motion.div>
          <motion.div variants={fadeUp}><StatCard ring={<ProgressRing value={overallCompletion} size={46} showValue={false} />} value={`${overallCompletion}%`} label="Overall Completion" /></motion.div>
          <motion.div variants={fadeUp}><StatCard icon={Trophy} value={completed} label="Certificates" tone="gold" /></motion.div>
          <motion.div variants={fadeUp}><StatCard icon={Clock} value={`${totalHours ? totalHours.toFixed(0) : 0}h`} label="Learning Hours" tone="blue" /></motion.div>
        </motion.div>

        {/* Settings */}
        <h2 className="text-lg font-semibold text-ink-strong mb-6">Settings</h2>
        <div className="flex flex-col gap-2 max-w-[560px]">
          {[
            { icon: Shield, label: "Account Settings" },
            { icon: Bell, label: "Notification Settings" },
            { icon: Lock, label: "Password" },
            { icon: Shield, label: "Privacy" },
          ].map((item) => (
            <button key={item.label} className="flex items-center gap-4 w-full p-4 bg-white border-2 border-line rounded-xl text-left text-sm font-medium text-ink-strong hover:border-gold hover:shadow-[0_4px_16px_rgba(255,182,6,0.08)] transition-all cursor-pointer">
              <item.icon size={18} weight="duotone" className="text-gold-dark" />
              <span>{item.label}</span>
            </button>
          ))}
          <button
            className="flex items-center gap-4 w-full p-4 bg-white border-2 border-red-soft rounded-xl text-left text-sm font-medium text-red hover:bg-red-soft transition-all cursor-pointer mt-2"
            onClick={() => { logout(); navigate("/"); }}
          >
            <SignOut size={18} weight="duotone" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </main>
  );
}
