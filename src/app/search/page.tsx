import { Suspense } from "react";
import PageLoader from "@/components/PageLoader";
import Search from "@/views/Search";

// Search reads `?q=` from the URL, so it needs a Suspense boundary.
export default function SearchPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Search />
    </Suspense>
  );
}