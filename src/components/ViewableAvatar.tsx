"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MagnifyingGlassPlus, X } from "@phosphor-icons/react";
import { mediaUrl } from "@/lib/api";
import UserAvatar from "@/components/UserAvatar";

const RING = "rounded-full p-1 bg-gradient-to-br from-gold via-gold-soft to-gold-dark shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]";

/**
 * A large profile photo in a gold ring. With a photo, clicking it opens a full-size round view
 * (Escape, the close button or a click outside closes it). Without one it shows the initial.
 */
export default function ViewableAvatar({
  name,
  src,
  color,
  className = "w-36 h-36 text-5xl",
  children,
}: {
  name: string;
  src?: string | null;
  color?: string;
  /** Size and font size of the circle. */
  className?: string;
  /** Overlaid on the circle, e.g. a camera button. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const url = mediaUrl(src);

  return (
    <div className="relative inline-block">
      {url ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`group relative block border-none cursor-zoom-in ${RING}`}
          aria-label={`View ${name}'s photo`}
        >
          <span className="block rounded-full bg-white p-1">
            <UserAvatar name={name} src={src} color={color} className={className} />
          </span>
          <span className="absolute inset-2 rounded-full flex items-center justify-center text-white opacity-0 bg-black/35 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
            <MagnifyingGlassPlus size={28} weight="bold" />
          </span>
        </button>
      ) : (
        <span className={`block ${RING}`}>
          <span className="block rounded-full bg-white p-1">
            <UserAvatar name={name} color={color} className={className} />
          </span>
        </span>
      )}
      {children}
      {open && url && <PhotoViewer name={name} url={url} onClose={() => setOpen(false)} />}
    </div>
  );
}

function PhotoViewer({ name, url, onClose }: { name: string; url: string; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name}'s photo`}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 p-6 bg-ink-strong/85 backdrop-blur-sm"
    >
      <button
        ref={closeButton}
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 w-11 h-11 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20 border-none cursor-pointer transition-colors"
        aria-label="Close photo"
      >
        <X size={20} weight="bold" />
      </button>
      <div onClick={(e) => e.stopPropagation()} className="rounded-full p-1.5 bg-gradient-to-br from-gold via-gold-soft to-gold-dark shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element -- user photos come from our API or Google */}
        <img
          src={url}
          alt={`${name}'s profile photo`}
          referrerPolicy="no-referrer"
          className="block w-[min(80vw,26rem)] aspect-square rounded-full object-cover bg-white"
        />
      </div>
      <p className="text-lg font-semibold text-white">{name}</p>
    </div>,
    document.body,
  );
}
