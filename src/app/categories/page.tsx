import { Suspense } from "react";
import PageLoader from "@/components/PageLoader";
import Category from "@/views/Category";

export default function CategoriesPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Category />
    </Suspense>
  );
}