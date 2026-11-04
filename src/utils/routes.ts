/** Full-screen areas (course player, portals, first-login password page) bring their own chrome instead of the site navbar/footer. */
export function usesSiteChrome(pathname: string): boolean {
  return !/^\/(learn|teach|admin|set-password)(\/|$)/.test(pathname);
}

/** Where each role lands after logging in. */
export function homeFor(role: string): string {
  return role === "TEACHER" ? "/teach" : role === "ADMIN" ? "/admin" : "/dashboard";
}
