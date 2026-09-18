import { Link } from "react-router-dom";
import Mascot from "./Mascot";

export default function EmptyState({
  pose = "sad",
  title,
  description,
  ctaLabel,
  ctaTo,
  className = "",
}) {
  return (
    <div className={`empty-state ${className}`}>
      <Mascot pose={pose} size={100} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {ctaLabel && ctaTo && (
        <Link to={ctaTo} className="btn btn-primary">{ctaLabel}</Link>
      )}
    </div>
  );
}
