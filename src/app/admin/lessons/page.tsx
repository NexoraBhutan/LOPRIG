import { Suspense } from "react";
import PageLoader from "@/components/PageLoader";
import AdminLessons from "@/views/admin/AdminLessons";

export const metadata = { title: "Lessons — Lop-rig admin portal" };

// AdminLessons reads `?teacher=` from the URL, so it needs a Suspense boundary.
export default function AdminLessonsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLessons />
    </Suspense>
  );
}
