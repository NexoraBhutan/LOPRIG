import { Suspense } from "react";
import About from "@/views/About";

export default function AboutPage() {
  return (
    <Suspense>
      <About />
    </Suspense>
  );
}