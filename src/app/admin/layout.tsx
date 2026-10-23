import type { ReactNode } from "react";
import { AdminRoute } from "@/components/RouteUtils";
import AdminShell from "@/components/admin/AdminShell";

export const metadata = { title: "Admin portal — Lop-rig" };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminRoute>
      <AdminShell>{children}</AdminShell>
    </AdminRoute>
  );
}
