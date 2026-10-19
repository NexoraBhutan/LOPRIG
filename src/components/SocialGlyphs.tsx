import type { SVGProps } from "react";

// Small original glyphs used only as generic social-link markers.
// Kept intentionally abstract rather than reproducing any brand's logo.

export function FacebookGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M14 21v-7h2.5l.5-3H14V9.2c0-.9.3-1.5 1.6-1.5H17V5.1C16.6 5 15.6 5 14.5 5 12.2 5 10.6 6.4 10.6 9v2H8v3h2.6v7h3.4Z" fill="currentColor" />
    </svg>
  );
}

export function InstagramGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="4" y="4" width="16" height="16" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.6" cy="7.4" r="1" fill="currentColor" />
    </svg>
  );
}

export function LinkedinGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8.2" cy="9" r="1.1" fill="currentColor" />
      <path d="M8.2 11.5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 16.5v-3c0-1.2.8-2 2-2s1.8.8 1.8 2v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 13.3v3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function YoutubeGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="3.5" y="6.5" width="17" height="11" rx="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.5 9.8v4.4l4-2.2-4-2.2Z" fill="currentColor" />
    </svg>
  );
}