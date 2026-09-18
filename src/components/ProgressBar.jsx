export default function ProgressBar({ value = 0, label, size = "md" }) {
  return (
    <div className={`progress-wrap progress-${size}`}>
      <div className="progress-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      {label !== false && <span className="progress-label">{value}% Complete</span>}
    </div>
  );
}
