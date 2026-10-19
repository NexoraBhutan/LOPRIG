import { Suspense } from "react";
import Signup from "@/views/Signup";

export default function SignupPage() {
  return (
    <Suspense>
      <Signup />
    </Suspense>
  );
}