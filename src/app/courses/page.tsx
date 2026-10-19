import { Suspense } from "react";
import PageLoader from "@/components/PageLoader";
import Courses from "@/views/Courses";

// Courses reads the URL search params to drive its filter state, so it has to
// sit under a Suspense boundary for static prerendering to succeed.
export default function CoursesPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Courses />
    </Suspense>
  );
}