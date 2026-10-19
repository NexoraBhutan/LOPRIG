import { Suspense } from "react";
import { ProtectedRoute } from "@/components/RouteUtils";
import CoursePlayer from "@/views/CoursePlayer";

export default function LearnPage() {
  return (
    <Suspense>
      <ProtectedRoute>
        <CoursePlayer />
      </ProtectedRoute>
    </Suspense>
  );
}