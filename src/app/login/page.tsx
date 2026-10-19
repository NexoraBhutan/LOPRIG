import { Suspense } from "react";
import PageLoader from "@/components/PageLoader";
import Login from "@/views/Login";

// Login reads the `?from=` redirect target, so it needs a Suspense boundary.
export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Login />
    </Suspense>
  );
}