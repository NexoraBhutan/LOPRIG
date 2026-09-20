import { Link } from "react-router-dom";
import Mascot from "./Mascot";

export default function EmptyState({
  pose = "sad",
  title,
  description,
  ctaLabel,
  ctaTo,
  ctaOutlined = false,
  ctaOnClick,
  className = "",
}) {
  const btnClass = ctaOutlined ? "btn btn-outline" : "btn btn-primary";

  return (
    <div className={`flex flex-col items-center justify-center text-center py-20 gap-5 ${className}`}>
      <Mascot pose={pose} size={100} />
      <h3 className="text-xl font-semibold text-ink-strong">{title}</h3>
      {description && <p className="text-ink-muted text-sm leading-relaxed max-w-[360px]">{description}</p>}
      {ctaLabel && ctaTo && (
        <Link to={ctaTo} className={btnClass}>{ctaLabel}</Link>
      )}
      {ctaLabel && ctaOnClick && !ctaTo && (
        <button onClick={ctaOnClick} className={btnClass}>{ctaLabel}</button>
      )}
    </div>
  );
}
