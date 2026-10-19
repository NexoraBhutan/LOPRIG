"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";

/**
 * Scrolls the window to the top whenever the route path changes — the
 * App Router equivalent of the old react-router ScrollToTop.
 */
export function ScrollToTop() {
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/**
 * Blocks a route behind a logged-in session. While auth is still resolving it
 * renders nothing (no flash of the protected content); once resolution is done
 * and there is no user, it sends the visitor to /login and remembers where
 * they were headed in the `from` query param.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    if (ready && !user) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [ready, user, router, pathname]);

  if (!ready || !user) return null;
  return <>{children}</>;
}