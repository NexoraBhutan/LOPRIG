import type { ReactNode } from "react";
import { TeacherRoute } from "@/components/RouteUtils";
import TeachShell from "@/components/teach/TeachShell";

export const metadata = { title: "Teacher portal — Lop-rig" };

export default function TeachLayout({ children }: { children: ReactNode }) {
  return (
    <TeacherRoute>
      <TeachShell>{children}</TeachShell>
    </TeacherRoute>
  );
}
