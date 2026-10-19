"use client";

import Link from "next/link";
import Mascot from "@/components/Mascot";
import type { MascotPose } from "@/types";

export default function EmptyState({
  pose = "sad",
  title,
  description,
  ctaLabel,
  ctaTo,
  ctaOutlined = false,
  ctaOnClick,
  className = "",
}: {
  pose?: MascotPose;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaTo?: string;
  ctaOutlined?: boolean;
  ctaOnClick?: () => void;
  className?: string;
}) {
  const btnClass = ctaOutlined ? "btn btn-outline btn-lg" : "btn btn-primary btn-lg";

  return (
    <div className={`flex flex-col items-center justify-center text-center py-20 gap-5 ${className}`}>
      <Mascot pose={pose} size={100} />
      <h3 className="text-xl font-semibold text-ink-strong">{title}</h3>
      {description && <p className="text-ink-muted text-sm leading-relaxed max-w-[360px]">{description}</p>}
      {ctaLabel && ctaTo && (
        <Link href={ctaTo} className={btnClass}>{ctaLabel}</Link>
      )}
      {ctaLabel && ctaOnClick && !ctaTo && (
        <button onClick={ctaOnClick} className={btnClass}>{ctaLabel}</button>
      )}
    </div>
  );
}