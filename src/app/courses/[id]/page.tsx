import { Suspense } from "react";
import PageLoader from "@/components/PageLoader";
import CourseDetails from "@/views/CourseDetails";

export default function CourseDetailsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CourseDetails />
    </Suspense>
  );
}