"use client";

import { useEffect, useState } from "react";
import { Users } from "@phosphor-icons/react";
import PageLoader from "@/components/PageLoader";
import ProgressBar from "@/components/ProgressBar";
import UserAvatar from "@/components/UserAvatar";
import { apiAll, errorMessage } from "@/lib/api";
import { timeAgo, type TeachStudent } from "@/lib/teach";

export default function StudentsTable({ courseId }: { courseId: string }) {
  const [students, setStudents] = useState<TeachStudent[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiAll<TeachStudent>(`/teach/courses/${courseId}/students/`)
      .then(setStudents)
      .catch((err) => setError(errorMessage(err)));
  }, [courseId]);

  if (error) return <p role="alert" className="text-sm text-red-dark">{error}</p>;
  if (!students) return <PageLoader />;

  if (!students.length) {
    return (
      <div className="bg-white border-2 border-line rounded-2xl p-10 text-center">
        <span className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gold-soft text-gold-dark flex items-center justify-center"><Users size={22} weight="duotone" /></span>
        <p className="font-semibold text-ink-strong">No students yet</p>
        <p className="text-sm text-ink-muted mt-1">Students appear here as soon as they enroll in this course.</p>
      </div>
    );
  }

  const completed = students.filter((s) => s.status === "COMPLETED").length;
  const average = Math.round(students.reduce((sum, s) => sum + s.progress, 0) / students.length);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink-strong">Students</h2>
        <p className="text-sm text-ink-muted">
          {students.length} enrolled · {completed} completed · {average}% average progress
        </p>
      </div>
      <div className="bg-white border-2 border-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-bg-soft">
              <tr className="text-left text-[0.7rem] font-bold uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-5 py-3">Student</th>
                <th scope="col" className="px-5 py-3 w-[34%]">Progress</th>
                <th scope="col" className="px-5 py-3">Enrolled</th>
                <th scope="col" className="px-5 py-3">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={s.name} src={s.avatar} color={s.avatar_color} />
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink-strong truncate">{s.name}</span>
                        <span className="block text-xs text-ink-muted truncate">{s.email}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1"><ProgressBar value={s.progress} size="sm" label={false} /></div>
                      <span className="text-xs font-bold text-ink-strong tabular-nums w-10 text-right">{s.progress}%</span>
                    </div>
                    <span className="text-xs text-ink-muted">
                      {s.status === "COMPLETED" ? "Completed" : `${s.completed_lessons} lesson${s.completed_lessons === 1 ? "" : "s"} done`}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-ink-muted whitespace-nowrap">{timeAgo(s.activated_at)}</td>
                  <td className="px-5 py-4 text-ink-muted whitespace-nowrap">{timeAgo(s.last_activity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
