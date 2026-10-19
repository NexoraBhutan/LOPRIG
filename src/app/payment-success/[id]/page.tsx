import { Suspense } from "react";
import { ProtectedRoute } from "@/components/RouteUtils";
import PaymentSuccess from "@/views/PaymentSuccess";

export default function PaymentSuccessPage() {
  return (
    <Suspense>
      <ProtectedRoute>
        <PaymentSuccess />
      </ProtectedRoute>
    </Suspense>
  );
}