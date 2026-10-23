import { Suspense } from "react";
import PageLoader from "@/components/PageLoader";
import AdminCourses from "@/views/admin/AdminCourses";

// AdminCourses reads `?status=` from the URL, so it needs a Suspense boundary.
export default function AdminCoursesPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminCourses />
    </Suspense>
  );
}
