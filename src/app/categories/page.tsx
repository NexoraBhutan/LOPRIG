import { Suspense } from "react";
import PageLoader from "@/components/PageLoader";
import { CategoryIndex } from "@/views/Category";

export default function CategoriesPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CategoryIndex />
    </Suspense>
  );
}