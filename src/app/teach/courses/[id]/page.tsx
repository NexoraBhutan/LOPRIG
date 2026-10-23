import { Suspense } from "react";
import PageLoader from "@/components/PageLoader";
import CourseEditor from "@/views/teach/CourseEditor";

// CourseEditor reads the active tab from `?tab=`, so it needs a Suspense boundary.
export default function CourseEditorPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CourseEditor />
    </Suspense>
  );
}
