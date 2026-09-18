export default function SkeletonRow({ lines = 3 }) {
  return (
    <div className="skeleton-row" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton-row-item">
          <div className="skeleton skeleton-row-thumb" />
          <div className="skeleton-row-content">
            <div className="skeleton skeleton-row-title" />
            {i < lines - 1 && <div className="skeleton skeleton-row-subtitle" />}
          </div>
        </div>
      ))}
    </div>
  );
}
