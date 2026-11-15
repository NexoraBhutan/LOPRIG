/**
 * Decorative photos that ship with the site (in /public), so pages never wait on an outside
 * image service. `photo(seed)` always gives the same picture for the same seed, so a course
 * or category keeps its look between visits.
 */
const PHOTOS = [
  "/hero-bhutan-school.jpg",
  "/hero-classroom.jpg",
  "/admin-hero-punakha.png",
  "/hero-laptop-learning.jpg",
  "/teacher-hero-valley.png",
  "/admin-account-desk.png",
  "/footer-classroom.png",
] as const;

export function photo(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PHOTOS[hash % PHOTOS.length];
}
