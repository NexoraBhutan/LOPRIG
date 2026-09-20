import { useId } from "react";

// The signature "progress ring" motif — a segmented dial rather than a smooth
// spinner, echoing the three-ascending-bars Logo mark (see Logo.jsx) built
// from the same idea: discrete steps adding up to a whole. Reserved for the
// one "how far along" number that matters most on a given surface (Dashboard
// overall completion, MyLearning's continue card, CoursePlayer's lesson
// progress) — everywhere else keep using the flat ProgressBar for lists.
export default function ProgressRing({
  value = 0,
  size = 64,
  tone = "brand", // "brand" (gold gradient, brand-moment) | "flat" (solid gold)
  showValue = true,
  label,
}) {
  const gradId = useId();
  const clamped = Math.min(100, Math.max(0, Math.round(value)));

  const segCount = size >= 80 ? 36 : size >= 56 ? 24 : 14;
  const filled = clamped > 0 ? Math.max(1, Math.round((clamped / 100) * segCount)) : 0;

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const tickLen = Math.max(4, size * 0.18);
  const innerR = outerR - tickLen;
  const strokeW = Math.max(2, Math.round(size * 0.055));
  const numberSize = Math.max(11, Math.round(size * 0.27));
  const percentSize = Math.max(8, Math.round(size * 0.14));

  return (
    <div className={`progress-ring progress-ring-${tone}`} style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={label || `${clamped}% complete`}
      >
        {tone === "brand" && (
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2={size} y2={size} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffb606" />
              <stop offset="100%" stopColor="#c88e00" />
            </linearGradient>
          </defs>
        )}
        {Array.from({ length: segCount }).map((_, i) => {
          const angle = (360 / segCount) * i - 90;
          const isFilled = i < filled;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy - outerR}
              x2={cx}
              y2={cy - innerR}
              strokeWidth={strokeW}
              strokeLinecap="round"
              stroke={isFilled ? (tone === "brand" ? `url(#${gradId})` : "#ffb606") : "#dcdcdc"}
              transform={`rotate(${angle} ${cx} ${cy})`}
              className={`progress-ring-seg ${isFilled ? "is-filled" : ""}`}
              style={{ transitionDelay: `${Math.min(i, 30) * 12}ms` }}
            />
          );
        })}
      </svg>
      {showValue && (
        <div className="progress-ring-center" aria-hidden="true">
          <strong style={{ fontSize: numberSize }}>{clamped}</strong>
          <small style={{ fontSize: percentSize }}>%</small>
        </div>
      )}
    </div>
  );
}
