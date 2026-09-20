export default function ProgressBar({ value = 0, label, size = "md" }) {
  const h = size === "sm" ? "h-1.5" : "h-2.5";
  return (
    <div className="w-full">
      <div className={`w-full ${h} bg-bg-sunken rounded-full overflow-hidden`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-gold rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      {label !== false && <span className="text-xs text-ink-muted mt-1.5 block">{value}% Complete</span>}
    </div>
  );
}
