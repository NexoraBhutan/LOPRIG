import type { ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";
import type { StatTone } from "@/types";

export default function StatCard({
  icon: Icon,
  value,
  label,
  tone = "green",
  ring,
}: {
  icon?: Icon;
  value: ReactNode;
  label: ReactNode;
  tone?: StatTone;
  ring?: ReactNode;
}) {
  const toneBg: Record<StatTone, string> = {
    green: "bg-gold-soft text-gold-dark",
    blue: "bg-bg-sunken text-ink",
    gold: "bg-gold-soft text-gold-dark",
  };
  return (
    <div className="bg-white border-2 border-line rounded-xl p-6 flex items-center gap-4 hover:border-gold transition-colors">
      {ring ? (
        <span className="flex-shrink-0">{ring}</span>
      ) : (
        Icon && (
          <span className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${toneBg[tone] || toneBg.green}`}>
            <Icon size={20} weight="duotone" />
          </span>
        )
      )}
      <div>
        <strong className="block text-xl font-bold text-ink-strong">{value}</strong>
        <span className="text-xs text-ink-muted">{label}</span>
      </div>
    </div>
  );
}