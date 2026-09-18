// Lop-rig wordmark. A plain inline SVG mark + text lockup, built from the
// app's own design tokens — flat brand gold, no gradient, no generated
// logo image (matches the sharp/flat visual language, not a glow effect).
export default function Logo({ size = "md" }) {
  return (
    <span className={`brand-logo brand-logo-${size}`}>
      <svg className="brand-mark" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="var(--gold)" />
        <rect x="8" y="17" width="4" height="8" rx="2" fill="var(--ink-strong)" />
        <rect x="14" y="12" width="4" height="13" rx="2" fill="var(--ink-strong)" />
        <rect x="20" y="7" width="4" height="18" rx="2" fill="var(--ink-strong)" />
      </svg>
      <span className="brand-word">
        Lop<span className="brand-word-accent">-rig</span>
      </span>
    </span>
  );
}
