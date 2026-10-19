import { Suspense } from "react";
import { ProtectedRoute } from "@/components/RouteUtils";
import MyLearning from "@/views/MyLearning";

export default function MyLearningPage() {
  return (
    <Suspense>
      <ProtectedRoute>
        <MyLearning />
      </ProtectedRoute>
    </Suspense>
  );
}