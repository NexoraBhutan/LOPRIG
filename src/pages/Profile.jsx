import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaPencilAlt, FaBook, FaAward, FaClock, FaBell, FaLock, FaShieldAlt, FaSignOutAlt } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { useEnrollment } from "../context/EnrollmentContext";
import { useToast } from "../context/ToastContext";
import StatCard from "../components/StatCard";
import ProgressRing from "../components/ProgressRing";

export default function Profile() {
  const { user, updateProfile, logout } = useAuth();
  const { enrolledCourses, getProgress } = useEnrollment();
  const { push } = useToast();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user?.name || "", bio: user?.bio || "" });

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
    <div className="page-enter container profile-page">
      <div className="profile-header card-plain">
        <span className="avatar avatar-lg" style={{ background: user.avatarColor }}>{user.name.charAt(0).toUpperCase()}</span>
        <div className="profile-header-info">
          {editing ? (
            <input className="profile-name-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          ) : (
            <h1>{user.name}</h1>
          )}
          <p>{user.email}</p>
          {editing ? (
            <textarea className="profile-bio-input" rows={2} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
          ) : (
            <p className="profile-bio">{user.bio}</p>
          )}
        </div>
        {editing ? (
          <button className="btn btn-primary" onClick={save}>Save changes</button>
        ) : (
          <button className="btn btn-outline" onClick={() => setEditing(true)}><FaPencilAlt size={13} /> Edit Profile</button>
        )}
      </div>

      <h2 className="profile-stats-title">Your learning</h2>
      <div className="dash-stats profile-stats">
        <StatCard icon={FaBook} value={enrolledCourses.length} label="Courses Enrolled" tone="green" />
        <StatCard
          ring={<ProgressRing value={overallCompletion} size={46} showValue={false} />}
          value={`${overallCompletion}%`}
          label="Overall Completion"
        />
        <StatCard icon={FaAward} value={completed} label="Certificates" tone="gold" />
        <StatCard icon={FaClock} value={`${totalHours ? totalHours.toFixed(0) : 0}h`} label="Learning Hours" tone="blue" />
      </div>

      <div className="settings-list card-plain">
        <h2>Settings</h2>
        <button className="settings-row"><FaShieldAlt size={16} /><span>Account Settings</span></button>
        <button className="settings-row"><FaBell size={16} /><span>Notification Settings</span></button>
        <button className="settings-row"><FaLock size={16} /><span>Password</span></button>
        <button className="settings-row"><FaShieldAlt size={16} /><span>Privacy</span></button>
        <button className="settings-row settings-row-danger" onClick={() => { logout(); navigate("/"); }}>
          <FaSignOutAlt size={16} /><span>Logout</span>
        </button>
      </div>
    </div>
  );
}
