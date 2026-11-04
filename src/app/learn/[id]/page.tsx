import { Suspense } from "react";
import CoursePlayer from "@/views/CoursePlayer";

// Not wrapped in ProtectedRoute: free courses are open to everyone. For paid courses the player
// sends signed-out visitors to the login page.
export default function LearnPage() {
  return (
    <Suspense>
      <CoursePlayer />
    </Suspense>
  );
}
