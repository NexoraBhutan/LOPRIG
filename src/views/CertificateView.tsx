"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, CheckCircle, DownloadSimple, LinkSimple, LinkedinLogo, SealCheck } from "@phosphor-icons/react";
import { useToast } from "@/context/ToastContext";
import EmptyState from "@/components/EmptyState";
import PageLoader from "@/components/PageLoader";
import { ApiError, api } from "@/lib/api";

interface CertificateData {
  valid: boolean;
  code: string;
  student_name: string;
  course: string;
  course_title: string;
  instructor_name: string;
  lessons_count: number;
  duration: string;
  skills: string[];
  assessment: { average: number; quizzes: number } | null;
  issued_at: string;
}

const INK = "#14161a";
const GOLD = "#c88e00";
const GOLD_LIGHT = "#e7b53c";
const SERIF = 'Georgia, "Times New Roman", serif';

/** Sizes in cqw (percent of the certificate's width): it scales the same on a phone, a laptop and paper. */
const cq = (n: number) => `${n}cqw`;

// A fine engraved-line pattern, like the background of a banknote, drawn very faintly.
const GUILLOCHE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60' viewBox='0 0 120 60'><g fill='none' stroke='${GOLD}' stroke-width='0.6' opacity='0.16'><path d='M0 30 Q30 0 60 30 T120 30'/><path d='M0 30 Q30 60 60 30 T120 30'/><path d='M0 20 Q30 -10 60 20 T120 20'/><path d='M0 40 Q30 70 60 40 T120 40'/></g></svg>`,
)}")`;

function Corner({ x, y }: { x: "left" | "right"; y: "top" | "bottom" }) {
  const size = cq(6);
  return (
    <span
      className="absolute"
      style={{
        [x]: cq(3.2), [y]: cq(3.2), width: size, height: size,
        [`border${y === "top" ? "Top" : "Bottom"}`]: `${cq(0.3)} solid ${GOLD}`,
        [`border${x === "left" ? "Left" : "Right"}`]: `${cq(0.3)} solid ${GOLD}`,
      }}
    >
      <span
        className="absolute rotate-45"
        style={{ [x]: cq(-0.75), [y]: cq(-0.75), width: cq(1.2), height: cq(1.2), background: GOLD }}
      />
    </span>
  );
}

function Seal() {
  return (
    <div className="relative flex flex-col items-center" style={{ width: cq(10) }}>
      {/* Ribbon tails */}
      <span className="absolute" style={{ top: cq(6.5), left: cq(2.6), width: cq(2.2), height: cq(4.2), background: GOLD, transform: "rotate(18deg)", clipPath: "polygon(0 0,100% 0,100% 100%,50% 82%,0 100%)" }} />
      <span className="absolute" style={{ top: cq(6.5), right: cq(2.6), width: cq(2.2), height: cq(4.2), background: "#a87700", transform: "rotate(-18deg)", clipPath: "polygon(0 0,100% 0,100% 100%,50% 82%,0 100%)" }} />
      <div
        className="relative flex flex-col items-center justify-center rounded-full text-white"
        style={{
          width: cq(9), height: cq(9),
          background: `radial-gradient(circle at 35% 30%, #ffe08a, ${GOLD_LIGHT} 40%, ${GOLD} 100%)`,
          boxShadow: `0 0 0 ${cq(0.35)} #fffdf8, 0 0 0 ${cq(0.5)} ${GOLD}, 0 ${cq(0.4)} ${cq(1)} rgba(0,0,0,0.18)`,
        }}
      >
        <span className="absolute rounded-full" style={{ inset: cq(0.6), border: `${cq(0.1)} dashed rgba(255,255,255,0.85)` }} />
        <SealCheck weight="fill" style={{ width: cq(3), height: cq(3) }} />
        <span className="font-bold uppercase" style={{ fontSize: cq(0.62), letterSpacing: "0.18em", marginTop: cq(0.15) }}>Lop-rig</span>
        <span className="font-bold uppercase" style={{ fontSize: cq(0.55), letterSpacing: "0.2em", opacity: 0.9 }}>Verified</span>
      </div>
    </div>
  );
}

function Signature({ name, label }: { name: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="italic truncate max-w-full" style={{ fontFamily: SERIF, fontSize: cq(1.7), lineHeight: 1.1, color: INK }}>{name}</p>
      <span style={{ marginTop: cq(0.5), width: "86%", height: cq(0.1), background: INK, opacity: 0.45 }} />
      <p className="uppercase font-bold" style={{ marginTop: cq(0.55), fontSize: cq(0.72), letterSpacing: "0.22em", color: "#6b6b6b" }}>{label}</p>
    </div>
  );
}

function Sheet({ c, className = "" }: { c: CertificateData; className?: string }) {
  const issued = new Date(c.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const first = c.student_name.split(" ")[0] || c.student_name;
  const host = typeof window === "undefined" ? "loprig" : window.location.host;
  const facts = [
    c.lessons_count ? `${c.lessons_count} ${c.lessons_count === 1 ? "lesson" : "lessons"}` : "",
    c.duration,
    c.assessment ? `Assessment score ${c.assessment.average}%` : "",
    `Issued ${issued}`,
  ].filter(Boolean);

  return (
    <div
      className={`certificate-sheet relative w-full overflow-hidden ${className}`}
      style={{ aspectRatio: "297 / 210", containerType: "inline-size", background: INK }}
      role="img"
      aria-label={`Certificate of completion: ${c.student_name} completed ${c.course_title} on ${issued}. Certificate ID ${c.code}.`}
    >
      {/* Paper inside the dark band */}
      <div
        className="absolute"
        style={{
          inset: cq(1.3),
          backgroundColor: "#fffdf7",
          backgroundImage: `radial-gradient(ellipse at 50% 0%, rgba(255,214,110,0.28), transparent 60%), ${GUILLOCHE}`,
          boxShadow: `inset 0 0 0 ${cq(0.25)} ${GOLD}, inset 0 0 0 ${cq(0.55)} #fffdf7, inset 0 0 0 ${cq(0.65)} ${GOLD}`,
        }}
      />
      <Corner x="left" y="top" />
      <Corner x="right" y="top" />
      <Corner x="left" y="bottom" />
      <Corner x="right" y="bottom" />

      {/* Body */}
      <div className="absolute inset-0 flex flex-col items-center text-center" style={{ padding: `${cq(4.6)} ${cq(10)} 0`, color: INK }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/loprig-logo-color.png" alt="Lop-rig" style={{ height: cq(3.4), width: "auto" }} />

        <div className="flex items-center" style={{ marginTop: cq(1.8), gap: cq(1.4) }}>
          <span style={{ width: cq(6), height: cq(0.12), background: GOLD }} />
          <span style={{ color: GOLD, fontSize: cq(1.2) }}>✦</span>
          <span style={{ width: cq(6), height: cq(0.12), background: GOLD }} />
        </div>
        <p className="font-display font-bold uppercase" style={{ marginTop: cq(0.9), fontSize: cq(3.4), letterSpacing: "0.3em", lineHeight: 1 }}>
          Certificate
        </p>
        <p className="font-bold uppercase" style={{ marginTop: cq(0.7), fontSize: cq(1.15), letterSpacing: "0.55em", color: GOLD }}>
          of Completion
        </p>

        <p style={{ marginTop: cq(2), fontSize: cq(1.15), color: "#6b6b6b" }}>This is proudly presented to</p>
        <p className="italic" style={{ marginTop: cq(0.5), fontFamily: SERIF, fontSize: cq(c.student_name.length > 26 ? 3.6 : 4.6), lineHeight: 1.1 }}>
          {c.student_name}
        </p>
        <span style={{ marginTop: cq(0.7), width: "48%", height: cq(0.14), background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />

        <p style={{ marginTop: cq(1.3), fontSize: cq(1.15), color: "#6b6b6b" }}>for successfully completing the online course</p>
        <p className="font-display font-bold" style={{ marginTop: cq(0.5), fontSize: cq(c.course_title.length > 48 ? 1.8 : 2.3), lineHeight: 1.2, maxWidth: "90%" }}>
          {c.course_title}
        </p>
        <p style={{ marginTop: cq(0.7), fontSize: cq(0.95), color: "#6b6b6b" }}>{facts.join("  ·  ")}</p>

        {c.skills.length > 0 && (
          <div style={{ marginTop: cq(1.6), width: "80%" }}>
            <p className="font-bold uppercase" style={{ fontSize: cq(0.75), letterSpacing: "0.25em", color: GOLD }}>What {first} learned</p>
            <ul className="grid text-left" style={{ marginTop: cq(0.8), gridTemplateColumns: c.skills.length > 3 ? "1fr 1fr" : "1fr", columnGap: cq(3), rowGap: cq(0.55) }}>
              {c.skills.map((s) => (
                <li key={s} className="flex items-center min-w-0" style={{ gap: cq(0.7), fontSize: cq(1), justifyContent: c.skills.length > 3 ? "flex-start" : "center" }}>
                  <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: cq(1.35), height: cq(1.35), background: GOLD, color: "#fff" }}>
                    <Check weight="bold" style={{ width: cq(0.85), height: cq(0.85) }} />
                  </span>
                  <span className="truncate">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Signatures and seal */}
      <div className="absolute grid items-end" style={{ left: cq(10), right: cq(10), bottom: cq(6.8), gridTemplateColumns: "1fr auto 1fr", columnGap: cq(4) }}>
        <Signature name={c.instructor_name} label="Instructor" />
        <Seal />
        <Signature name="Lop-rig" label={`Issued ${issued}`} />
      </div>

      <p className="absolute inset-x-0 text-center" style={{ bottom: cq(2.7), fontSize: cq(0.72), letterSpacing: "0.06em", color: "#7a7a7a" }}>
        Certificate ID <strong style={{ color: INK }}>{c.code}</strong>  ·  Verify at {host}/certificates/{c.code}
      </p>
    </div>
  );
}

export default function CertificateView() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toUpperCase();
  const { push } = useToast();
  const [cert, setCert] = useState<CertificateData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let alive = true;
    api<CertificateData>(`/certificates/verify/${encodeURIComponent(code)}/`)
      .then((c) => {
        if (!alive) return;
        setCert(c);
        setState("ready");
        document.title = `${c.student_name} · ${c.course_title} · Lop-rig certificate`;
      })
      .catch((err) => alive && setState(err instanceof ApiError && err.status === 404 ? "missing" : "error"));
    return () => {
      alive = false;
    };
  }, [code]);

  if (state === "loading") return <PageLoader />;
  if (!cert) {
    return (
      <div className="min-h-[70dvh] flex items-center justify-center px-8 pt-28">
        <EmptyState
          pose="sad"
          title={state === "missing" ? "We couldn't find this certificate" : "Couldn't load this certificate"}
          description={state === "missing" ? `No Lop-rig certificate has the ID ${code}. Check the ID and try again.` : "Check your connection and try again."}
          ctaLabel="Browse courses"
          ctaTo="/courses"
        />
      </div>
    );
  }

  const url = typeof window === "undefined" ? "" : window.location.href;
  const issued = new Date(cert.issued_at);

  const download = () => {
    const previous = document.title;
    document.title = `Lop-rig certificate - ${cert.student_name} - ${cert.course_title}`;  // the PDF's file name
    push("Choose “Save as PDF” as the printer to download it.", "info");
    window.print();
    document.title = previous;
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      push("Link copied. Anyone with it can view and verify this certificate.", "success");
    } catch {
      push(url, "info");
    }
  };

  const linkedIn = `https://www.linkedin.com/profile/add?${new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: cert.course_title,
    organizationName: "Lop-rig",
    issueYear: String(issued.getFullYear()),
    issueMonth: String(issued.getMonth() + 1),
    certUrl: url,
    certId: cert.code,
  })}`;

  return (
    <main className="overflow-x-hidden w-full px-4 sm:px-8 lg:px-16 pt-32 pb-24 aw-gold-wash">
      <div className="max-w-[1100px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 text-xs font-bold">
              <CheckCircle size={14} weight="fill" /> Verified certificate
            </p>
            <h1 className="mt-3 font-display text-3xl md:text-4xl tracking-tight font-semibold text-ink-strong">{cert.course_title}</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Awarded to <strong className="text-ink-strong">{cert.student_name}</strong> on{" "}
              {issued.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              {cert.assessment ? ` with an assessment score of ${cert.assessment.average}%.` : " for completing every lesson."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={download} className="btn btn-md btn-primary">
              <DownloadSimple size={15} weight="bold" /> Download PDF
            </button>
            <button type="button" onClick={copy} className="btn btn-md btn-outline-neutral">
              <LinkSimple size={15} weight="bold" /> Copy link
            </button>
            <a href={linkedIn} target="_blank" rel="noopener noreferrer" className="btn btn-md btn-outline-neutral no-underline">
              <LinkedinLogo size={15} weight="fill" /> Add to LinkedIn
            </a>
          </div>
        </div>

        <Sheet c={cert} className="rounded-xl shadow-elevated" />

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-white border-2 border-line p-5">
            <h2 className="text-sm font-bold text-ink-strong">Share it with confidence</h2>
            <p className="mt-1 text-sm text-ink-muted leading-relaxed">
              This page is public, so employers and schools can open the link and see that the certificate is genuine.
              It never shows your email or any private details.
            </p>
          </div>
          <div className="rounded-2xl bg-white border-2 border-line p-5">
            <h2 className="text-sm font-bold text-ink-strong">Keep learning</h2>
            <p className="mt-1 text-sm text-ink-muted leading-relaxed">
              Revisit <Link href={`/learn/${cert.course}`} className="font-bold text-gold-dark hover:text-gold">{cert.course_title}</Link> any
              time, or <Link href="/courses" className="font-bold text-gold-dark hover:text-gold">find your next course</Link>.
            </p>
          </div>
        </div>
      </div>

      {/* The printed copy: a direct child of <body>, so printing shows this one page and nothing else. */}
      {mounted && createPortal(<div className="certificate-print-root" aria-hidden="true"><Sheet c={cert} /></div>, document.body)}
    </main>
  );
}
