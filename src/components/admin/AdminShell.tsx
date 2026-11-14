"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bell, BookOpen, Certificate, ChatCircleText, Exam, Eye, GraduationCap, ListBullets,
  PlayCircle, Receipt, SquaresFour, Tag, TrendUp, Users,
} from "@phosphor-icons/react";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";
import { api } from "@/lib/api";

/**
 * The admin portal's frame. Its menu matches the site administration (Django admin) sidebar:
 * same sections, items and order. Courses, Users, Enrollments and Payments open the portal's
 * own pages (review, invite, verify); the rest open the matching table under /admin/data.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingCourses, setPendingCourses] = useState(0);
  const [toVerify, setToVerify] = useState(0);

  // Refresh the badges whenever the admin moves between pages (e.g. after approving).
  useEffect(() => {
    const count = (path: string, set: (n: number) => void) =>
      api<{ count: number }>(path).then((page) => set(page.count)).catch(() => undefined);
    count("/manage/courses/?status=PENDING_REVIEW", setPendingCourses);
    count("/manage/payments/?status=PENDING", setToVerify);
  }, [pathname]);

  const nav: PortalNavItem[] = [
    { section: "Overview", href: "/admin", label: "Dashboard", icon: SquaresFour },

    { section: "Catalogue", href: "/admin/courses", label: "Courses", icon: BookOpen, badge: pendingCourses },
    { section: "Catalogue", href: "/admin/data/categories", label: "Categories", icon: Tag },
    { section: "Catalogue", href: "/admin/data/chapters", label: "Modules", icon: ListBullets },
    { section: "Catalogue", href: "/admin/lessons", label: "Lessons", icon: PlayCircle, match: (p) => p.startsWith("/admin/lessons") || p.startsWith("/admin/data/lessons") },
    { section: "Catalogue", href: "/admin/data/quizzes", label: "Chapter quizzes", icon: Exam },

    { section: "People", href: "/admin/users", label: "Users", icon: Users },

    { section: "Learning", href: "/admin/enrollments", label: "Enrollments", icon: GraduationCap },
    { section: "Learning", href: "/admin/data/lesson-progress", label: "Lesson progress", icon: TrendUp },
    { section: "Learning", href: "/admin/data/comments", label: "Lesson comments", icon: ChatCircleText },
    { section: "Learning", href: "/admin/data/lesson-views", label: "Lesson views", icon: Eye },
    { section: "Learning", href: "/admin/data/certificates", label: "Certificates", icon: Certificate },

    { section: "Money & messages", href: "/admin/payments", label: "Payments", icon: Receipt, badge: toVerify },
    { section: "Money & messages", href: "/admin/data/notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <PortalShell label="Admin portal" home="/admin" nav={nav} searchable backgroundImage="/admin-account-desk.png">
      {children}
    </PortalShell>
  );
}
