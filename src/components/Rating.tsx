import { Star } from "@phosphor-icons/react";

export default function Rating({
  value,
  count,
  size = 14,
  showCount = true,
  light = false,
}: {
  value: number;
  count?: number | null;
  size?: number;
  showCount?: boolean;
  /** Use on dark backgrounds. */
  light?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`Rated ${value} out of 5`}>
      <Star size={size} weight="fill" className="text-gold" />
      <strong className={`text-sm font-bold ${light ? "text-white" : "text-ink-strong"}`}>{value.toFixed(1)}</strong>
      {showCount && count != null && (
        <span className={`text-xs ${light ? "text-white/60" : "text-ink-muted"}`}>({count.toLocaleString()})</span>
      )}
    </span>
  );
}