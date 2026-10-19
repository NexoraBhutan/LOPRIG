import type { LogoSize, LogoTone } from "@/types";

export default function Logo({ size = "md", tone = "dark" }: { size?: LogoSize; tone?: LogoTone }) {
  const sizes: Record<LogoSize, { svg: number; text: string }> = {
    sm: { svg: 24, text: "text-base" },
    md: { svg: 32, text: "text-xl" },
    lg: { svg: 40, text: "text-2xl" },
  };
  const s = sizes[size] ?? sizes.md;
  const wordmark = tone === "light" ? "text-white" : "text-ink-strong";
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 32 32" width={s.svg} height={s.svg} aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#ffb606" />
        <rect x="8" y="17" width="4" height="8" rx="2" fill="#1a1a1a" />
        <rect x="14" y="12" width="4" height="13" rx="2" fill="#1a1a1a" />
        <rect x="20" y="7" width="4" height="18" rx="2" fill="#1a1a1a" />
      </svg>
      <span className={`${s.text} font-bold ${wordmark} tracking-tight`}>
        Lop<span className="text-gold-dark">-rig</span>
      </span>
    </span>
  );
}