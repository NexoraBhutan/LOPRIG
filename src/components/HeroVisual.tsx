import { Trophy, PlayCircle, Fire } from "@phosphor-icons/react";
import Mascot from "@/components/Mascot";

export default function HeroVisual() {
  return (
    <div className="relative w-[300px] h-[300px] lg:w-[360px] lg:h-[360px]" aria-hidden="true">
      <Mascot pose="celebrate" size={260} className="absolute inset-0 m-auto" />
      <div className="absolute top-4 right-0 inline-flex items-center gap-2 bg-emerald-50 text-emerald-600 text-xs font-bold px-3 py-2 rounded-xl shadow-soft">
        <Trophy size={16} weight="duotone" /> Certificate on completion
      </div>
      <div className="absolute bottom-12 -left-4 inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-xs font-bold px-3 py-2 rounded-xl shadow-soft">
        <PlayCircle size={16} weight="duotone" /> 1,200+ video lessons
      </div>
      <div className="absolute bottom-0 right-4 inline-flex items-center gap-2 bg-gold-soft text-gold-dark text-xs font-bold px-3 py-2 rounded-xl shadow-soft">
        <Fire size={16} weight="duotone" /> Learn at your pace
      </div>
    </div>
  );
}