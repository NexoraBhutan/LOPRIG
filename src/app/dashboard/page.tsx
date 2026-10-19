import { Suspense } from "react";
import { ProtectedRoute } from "@/components/RouteUtils";
import Dashboard from "@/views/Dashboard";

export default function DashboardPage() {
  return (
    <Suspense>
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    </Suspense>
  );
}