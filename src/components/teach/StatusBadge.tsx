import { STATUS_META, type CourseStatus } from "@/lib/teach";

export default function StatusBadge({ status, className = "" }: { status: CourseStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.7rem] font-bold uppercase tracking-wider ${meta.className} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
