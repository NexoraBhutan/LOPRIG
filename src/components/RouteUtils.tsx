"use client";

import { useEffect, useRef } from "react";
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
 * they were headed in the `from` query param. If the user logs out while on
 * the page, it sends them home instead of bouncing them to /login.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const hadUser = useRef(false);

  useEffect(() => {
    if (user) {
      hadUser.current = true;
    } else if (ready) {
      router.replace(hadUser.current ? "/" : `/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [ready, user, router, pathname]);

  if (!ready || !user) return null;
  return <>{children}</>;
}

/**
 * The teacher portal: signed-out visitors go to /login, signed-in non-teachers
 * go home. The API enforces the same rule; this only avoids showing a broken page.
 */
export function TeacherRoute({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/teach";

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    else if (user.role !== "TEACHER") router.replace("/");
  }, [ready, user, router, pathname]);

  if (!ready || user?.role !== "TEACHER") return null;
  return <>{children}</>;
}
/** The admin portal: same rules as TeacherRoute, for the ADMIN role. */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/admin";

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    else if (user.role !== "ADMIN") router.replace("/");
  }, [ready, user, router, pathname]);

  if (!ready || user?.role !== "ADMIN") return null;
  return <>{children}</>;
}
