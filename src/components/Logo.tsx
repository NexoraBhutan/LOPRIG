import Image from "next/image";
import type { LogoSize, LogoTone } from "@/types";

// Both PNGs have transparent backgrounds. The navy-and-teal one (975x284) is for light
// surfaces like the navbar; the all-white one (975x267) is for dark surfaces like the footer.
const SRC: Record<LogoTone, { src: string; ratio: number }> = {
  dark: { src: "/loprig-logo-color.png", ratio: 975 / 284 },
  light: { src: "/loprig-logo-white.png", ratio: 975 / 267 },
};

export default function Logo({ size = "md", tone = "dark" }: { size?: LogoSize; tone?: LogoTone }) {
  const heights: Record<LogoSize, number> = { sm: 28, md: 36, lg: 46 };
  const h = heights[size] ?? heights.md;
  const { src, ratio } = SRC[tone] ?? SRC.dark;
  // Wrapped so a stretching flex parent (e.g. the footer's flex-col) can't widen the image.
  return (
    <span className="inline-flex shrink-0 self-start items-center">
      <Image
        src={src}
        alt="Lop-rig"
        width={Math.round(h * ratio)}
        height={h}
        priority
        className="block max-w-none object-contain"
        style={{ height: h, width: Math.round(h * ratio) }}
      />
    </span>
  );
}
