/** Full-screen areas (course player, teacher and admin portals) bring their own chrome instead of the site navbar/footer. */
export function usesSiteChrome(pathname: string): boolean {
  return !/^\/(learn|teach|admin)(\/|$)/.test(pathname);
}
