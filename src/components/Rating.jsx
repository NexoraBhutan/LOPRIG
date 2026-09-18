import { FaStar } from "react-icons/fa";

export default function Rating({ value, count, size = 14, showCount = true }) {
  return (
    <span className="rating" aria-label={`Rated ${value} out of 5`}>
      <FaStar size={size} color="var(--gold)" />
      <strong>{value.toFixed(1)}</strong>
      {showCount && count != null && <span className="rating-count">({count.toLocaleString()})</span>}
    </span>
  );
}
