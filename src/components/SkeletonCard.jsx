export default function SkeletonCard() {
  return (
    <div className="skeleton-card card-plain" aria-hidden="true">
      <div className="skeleton skeleton-card-thumb" />
      <div className="skeleton-card-body">
        <div className="skeleton skeleton-card-cat" />
        <div className="skeleton skeleton-card-title" />
        <div className="skeleton skeleton-card-title skeleton-card-title-short" />
        <div className="skeleton-card-meta">
          <div className="skeleton skeleton-card-meta-item" />
          <div className="skeleton skeleton-card-meta-item" />
        </div>
        <div className="skeleton skeleton-card-price" />
      </div>
    </div>
  );
}
