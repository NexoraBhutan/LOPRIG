"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SquaresFour, BookOpen, PlusCircle, UserCircle, Exam } from "@phosphor-icons/react";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";
import { api } from "@/lib/api";
import type { TeachSummary } from "@/lib/teach";

const NAV: PortalNavItem[] = [
  { href: "/teach", label: "Dashboard", icon: SquaresFour },
  {
    href: "/teach/courses",
    label: "My courses",
    icon: BookOpen,
    match: (p) => p.startsWith("/teach/courses") && p !== "/teach/courses/new",
  },
  { href: "/teach/courses/new", label: "New course", icon: PlusCircle },
  { href: "/teach/reviews", label: "Reviews", icon: Exam },
  { href: "/teach/account", label: "Account", icon: UserCircle },
];

// A teacher still on an emailed temporary password never reaches this shell: PasswordSetupGuard
// sends them to /set-password first.
export default function TeachShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(0);

  // Answers waiting to be marked; refreshed on every page change so it drops as the teacher marks them.
  useEffect(() => {
    api<TeachSummary>("/teach/summary/").then((s) => setPending(s.pending_reviews)).catch(() => undefined);
  }, [pathname]);

  const nav = NAV.map((item) => (item.href === "/teach/reviews" ? { ...item, badge: pending } : item));
  return (
    <PortalShell label="Teacher portal" home="/teach" nav={nav} theme="warm">
      {children}
    </PortalShell>
  );
}
