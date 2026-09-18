// Shared stat tile — used by Dashboard and Profile, which previously
// repeated the exact same 4-card markup independently. Pass `ring` (a
// <ProgressRing/> element) instead of `icon` for the one stat that represents
// a "how far along" percentage rather than a raw count.
export default function StatCard({ icon: Icon, value, label, tone = "green", ring }) {
  return (
    <div className="dash-stat card-plain">
      {ring ? (
        <span className="dash-stat-ring">{ring}</span>
      ) : (
        <span className={`dash-stat-icon dash-stat-icon-${tone}`}><Icon size={20} /></span>
      )}
      <div><strong>{value}</strong><span>{label}</span></div>
    </div>
  );
}
