import { Suspense } from "react";
import PageLoader from "@/components/PageLoader";
import Category from "@/views/Category";

export default function CategoryDetailPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Category />
    </Suspense>
  );
}