import { Suspense } from "react";
import { ProtectedRoute } from "@/components/RouteUtils";
import Checkout from "@/views/Checkout";

export default function CheckoutPage() {
  return (
    <Suspense>
      <ProtectedRoute>
        <Checkout />
      </ProtectedRoute>
    </Suspense>
  );
}