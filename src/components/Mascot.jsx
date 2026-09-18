// Original mascot: a takin, Bhutan's national animal — a stocky
// goat-antelope, stylized as a simple, chunky, flat-shape character (no
// outlines, no photo reference, no external image) in the spirit of the
// app's playful visual language. Deliberately NOT a bird, and deliberately
// simplified rather than photorealistic, so it reads as our own character
// rather than a copy of any existing mascot.
//
// `pose` drives expression + arm/ear position: "idle" | "celebrate" |
// "thinking" | "sad". Used in the hero, empty states, and success moments.

const FUR = "#d9a441";
const FUR_SHADE = "#b3822a";
const FUR_DARK = "#8c6a2f";
const BELLY = "#fdf3d8";
const HOOF = "#6b4a23";

export default function Mascot({ pose = "idle", size = 160, className = "" }) {
  const armsUp = pose === "celebrate";
  const thinking = pose === "thinking";
  const sad = pose === "sad";

  return (
    <svg
      className={`mascot mascot-${pose} ${className}`}
      viewBox="0 0 240 240"
      width={size}
      height={size}
      role="img"
      aria-label={
        pose === "celebrate" ? "Takin mascot celebrating" :
        pose === "thinking" ? "Takin mascot thinking" :
        pose === "sad" ? "Takin mascot looking sad" :
        "Takin mascot"
      }
    >
      <ellipse cx="120" cy="222" rx="58" ry="10" fill="#000" opacity="0.08" />

      {/* tail */}
      <ellipse cx="62" cy="150" rx="14" ry="20" fill={FUR_SHADE} transform="rotate(-20 62 150)" />

      {/* back legs */}
      <rect x="86" y="188" width="24" height="34" rx="12" fill={FUR_SHADE} />
      <rect x="132" y="188" width="24" height="34" rx="12" fill={FUR_SHADE} />
      <rect x="84" y="212" width="28" height="14" rx="7" fill={HOOF} />
      <rect x="130" y="212" width="28" height="14" rx="7" fill={HOOF} />

      {/* body */}
      <ellipse cx="120" cy="150" rx="70" ry="58" fill={FUR} />
      <ellipse cx="120" cy="168" rx="42" ry="32" fill={BELLY} />

      {/* arms */}
      {armsUp ? (
        <>
          <path d="M66 132 Q40 90 52 62" stroke={FUR} strokeWidth="22" strokeLinecap="round" fill="none" />
          <path d="M174 132 Q200 90 188 62" stroke={FUR} strokeWidth="22" strokeLinecap="round" fill="none" />
          <circle cx="50" cy="58" r="13" fill={HOOF} />
          <circle cx="190" cy="58" r="13" fill={HOOF} />
        </>
      ) : thinking ? (
        <>
          <path d="M70 140 Q60 170 72 190" stroke={FUR} strokeWidth="22" strokeLinecap="round" fill="none" />
          <path d="M170 140 Q150 108 128 96" stroke={FUR} strokeWidth="22" strokeLinecap="round" fill="none" />
          <circle cx="126" cy="94" r="13" fill={HOOF} />
        </>
      ) : (
        <>
          <path d={sad ? "M68 138 Q56 165 62 188" : "M68 138 Q52 165 66 188"} stroke={FUR} strokeWidth="22" strokeLinecap="round" fill="none" />
          <path d={sad ? "M172 138 Q184 165 178 188" : "M172 138 Q188 165 174 188"} stroke={FUR} strokeWidth="22" strokeLinecap="round" fill="none" />
        </>
      )}

      {/* head */}
      <g transform={sad ? "translate(0 6)" : "translate(0 0)"}>
        {/* horns */}
        <path d="M96 70 Q84 44 96 28" stroke={FUR_DARK} strokeWidth="12" strokeLinecap="round" fill="none" />
        <path d="M144 70 Q156 44 144 28" stroke={FUR_DARK} strokeWidth="12" strokeLinecap="round" fill="none" />

        {/* ears */}
        <ellipse cx="78" cy="86" rx="15" ry="22" fill={FUR} transform={`rotate(${sad ? 35 : -18} 78 86)`} />
        <ellipse cx="162" cy="86" rx="15" ry="22" fill={FUR} transform={`rotate(${sad ? -35 : 18} 162 86)`} />

        {/* face */}
        <ellipse cx="120" cy="100" rx="52" ry="48" fill={FUR} />
        <ellipse cx="120" cy="118" rx="30" ry="26" fill={BELLY} />

        {/* blush */}
        {!sad && !thinking && (
          <>
            <ellipse cx="92" cy="112" rx="9" ry="6" fill="#ff9d8a" opacity="0.55" />
            <ellipse cx="148" cy="112" rx="9" ry="6" fill="#ff9d8a" opacity="0.55" />
          </>
        )}

        {/* eyes */}
        {thinking ? (
          <>
            <circle cx="103" cy="94" r="7" fill="#2b2b2b" />
            <circle cx="137" cy="90" r="7" fill="#2b2b2b" />
          </>
        ) : sad ? (
          <>
            <path d="M96 92 q7 -6 14 0" stroke="#2b2b2b" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M130 92 q7 -6 14 0" stroke="#2b2b2b" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M100 104 q3 10 -2 14" stroke="#6fc7f0" strokeWidth="5" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <circle cx="102" cy="96" r="9" fill="#2b2b2b" />
            <circle cx="138" cy="96" r="9" fill="#2b2b2b" />
            <circle cx="105" cy="93" r="2.6" fill="#fff" />
            <circle cx="141" cy="93" r="2.6" fill="#fff" />
          </>
        )}

        {/* nose + mouth */}
        <ellipse cx="120" cy="122" rx="7" ry="5" fill="#5a4224" />
        {sad ? (
          <path d="M108 134 Q120 126 132 134" stroke="#5a4224" strokeWidth="4" strokeLinecap="round" fill="none" />
        ) : thinking ? (
          <path d="M112 132 Q120 132 128 130" stroke="#5a4224" strokeWidth="4" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M106 128 Q120 142 134 128" stroke="#5a4224" strokeWidth="4" strokeLinecap="round" fill="none" />
        )}
      </g>

      {armsUp && (
        <>
          <circle cx="40" cy="44" r="4" fill="var(--gold)" />
          <circle cx="200" cy="40" r="5" fill="var(--gold-dark)" />
          <circle cx="70" cy="26" r="3.5" fill="var(--red)" />
          <circle cx="176" cy="24" r="4" fill="var(--ink-strong)" />
        </>
      )}
    </svg>
  );
}
