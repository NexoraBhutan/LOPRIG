"use client";

import { SquaresFour, BookOpen, PlusCircle } from "@phosphor-icons/react";
import PortalShell, { type PortalNavItem } from "@/components/portal/PortalShell";

const NAV: PortalNavItem[] = [
  { href: "/teach", label: "Dashboard", icon: SquaresFour },
  {
    href: "/teach/courses",
    label: "My courses",
    icon: BookOpen,
    match: (p) => p.startsWith("/teach/courses") && p !== "/teach/courses/new",
  },
  { href: "/teach/courses/new", label: "New course", icon: PlusCircle },
];

export default function TeachShell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell label="Teacher portal" home="/teach" nav={NAV}>
      {children}
    </PortalShell>
  );
}
