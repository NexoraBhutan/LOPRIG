"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SquaresFour, ClipboardText, Users, GraduationCap, Receipt, Database } from "@phosphor-icons/react";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";
import { API_URL, api } from "@/lib/api";

/** Django Admin lives on the API server; handy for raw data the portal doesn't show. */
const DJANGO_ADMIN_URL = `${API_URL.replace(/\/api\/v1$/, "")}/admin/`;

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(0);

  // Refresh the review badge whenever the admin moves between pages (e.g. after approving).
  useEffect(() => {
    api<{ count: number }>("/manage/courses/?status=PENDING_REVIEW")
      .then((page) => setPending(page.count))
      .catch(() => undefined);
  }, [pathname]);

  const nav: PortalNavItem[] = [
    { href: "/admin", label: "Dashboard", icon: SquaresFour },
    { href: "/admin/courses", label: "Course review", icon: ClipboardText, badge: pending },
    { href: "/admin/users", label: "Users & teachers", icon: Users },
    { href: "/admin/enrollments", label: "Enrollments", icon: GraduationCap },
    { href: "/admin/payments", label: "Payments", icon: Receipt },
    { href: DJANGO_ADMIN_URL, label: "Raw data (Django)", icon: Database, match: () => false },
  ];

  return (
    <PortalShell label="Admin portal" home="/admin" nav={nav}>
      {children}
    </PortalShell>
  );
}
