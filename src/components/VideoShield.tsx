"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CornersIn, CornersOut, ShieldWarning } from "@phosphor-icons/react";

const MOVE_EVERY_MS = 7000;
const CHECK_EVERY_MS = 400;
const PRINT_SCREEN_COVER_MS = 3000;

/**
 * Wraps a lesson video for students to discourage screen recording and screenshots:
 *  - a faint watermark with the student's name and email moves around the video, so any leaked
 *    recording or screenshot shows who made it;
 *  - the video is covered whenever this page isn't the focused window (tab switched, Snipping Tool or
 *    another app opened) and for a few seconds after Print Screen;
 *  - right-click is off, and full screen uses our own button so the watermark stays on screen.
 *
 * A website can't fully block recording; DRM (Bunny MediaCage) and a mobile app can go further.
 */
export default function VideoShield({ viewer, children }: {
  viewer: { name: string; email: string };
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState({ top: 12, left: 8 });
  const [away, setAway] = useState(false);
  const [snapped, setSnapped] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const stamp = `${viewer.name} · ${viewer.email} · ${new Date().toLocaleDateString("en-GB")}`;

  // Move the watermark so it can't be cropped or blurred out of a recording.
  useEffect(() => {
    const timer = setInterval(() => setSpot({ top: 6 + Math.random() * 74, left: 4 + Math.random() * 50 }), MOVE_EVERY_MS);
    return () => clearInterval(timer);
  }, []);

  // Cover the video while the page isn't the focused window. Clicking into the player keeps focus
  // inside this page (document.hasFocus() stays true), so normal watching isn't affected.
  useEffect(() => {
    const check = () => setAway(document.hidden || !document.hasFocus());
    const timer = setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("blur", check);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("blur", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  // Print Screen: cover the video for a moment and clear what was copied, where the browser allows it.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "PrintScreen") return;
      setSnapped(true);
      clearTimeout(timer);
      timer = setTimeout(() => setSnapped(false), PRINT_SCREEN_COVER_MS);
      navigator.clipboard?.writeText("").catch(() => undefined);
    };
    window.addEventListener("keyup", onKey);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else box.current?.requestFullscreen().catch(() => undefined);
  };

  const covered = away || snapped;

  return (
    <div
      ref={box}
      className="absolute inset-0 bg-black select-none"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}

      {/* Moving watermark */}
      <span
        aria-hidden="true"
        className="absolute z-10 pointer-events-none max-w-[60%] truncate text-[11px] sm:text-xs font-semibold text-white/35 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)] transition-all duration-[1500ms] ease-in-out"
        style={{ top: `${spot.top}%`, left: `${spot.left}%` }}
      >
        {stamp}
      </span>
      {/* A second, fainter copy in the opposite corner area */}
      <span
        aria-hidden="true"
        className="absolute z-10 pointer-events-none max-w-[60%] truncate text-[10px] font-semibold text-white/20 transition-all duration-[1500ms] ease-in-out"
        style={{ top: `${86 - spot.top}%`, left: `${50 - spot.left / 2}%` }}
      >
        {viewer.email}
      </span>

      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={fullscreen ? "Exit full screen" : "Full screen"}
        title={fullscreen ? "Exit full screen" : "Full screen"}
        className="absolute z-20 top-3 right-3 w-9 h-9 rounded-lg flex items-center justify-center bg-black/45 hover:bg-black/70 text-white border-none cursor-pointer transition-colors"
      >
        {fullscreen ? <CornersIn size={18} weight="bold" /> : <CornersOut size={18} weight="bold" />}
      </button>

      {covered && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-ink-strong/95 backdrop-blur-xl text-center px-6" role="status">
          <ShieldWarning size={40} weight="duotone" className="text-gold" />
          <p className="text-white font-semibold">
            {snapped ? "Screenshots aren't allowed" : "Video hidden while you're away"}
          </p>
          <p className="text-white/60 text-sm max-w-[420px]">
            {snapped
              ? "Recording or screenshotting lessons breaks Lop-rig's rules and can get your account locked."
              : "Come back to this window to keep watching. Recording lessons isn't allowed."}
          </p>
        </div>
      )}
    </div>
  );
}
