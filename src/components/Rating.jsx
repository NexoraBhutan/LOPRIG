import { Star } from "@phosphor-icons/react";

export default function Rating({ value, count, size = 14, showCount = true }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`Rated ${value} out of 5`}>
      <Star size={size} weight="fill" className="text-gold" />
      <strong className="text-sm font-bold text-ink-strong">{value.toFixed(1)}</strong>
      {showCount && count != null && (
        <span className="text-xs text-ink-muted">({count.toLocaleString()})</span>
      )}
    </span>
  );
}
