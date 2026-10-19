import { Suspense } from "react";
import { ProtectedRoute } from "@/components/RouteUtils";
import Profile from "@/views/Profile";

export default function ProfilePage() {
  return (
    <Suspense>
      <ProtectedRoute>
        <Profile />
      </ProtectedRoute>
    </Suspense>
  );
}