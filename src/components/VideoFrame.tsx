"use client";

import type { Ref } from "react";
import { isEmbedded, type Playback } from "@/lib/video";

/**
 * Plays a lesson video: hosted players (Bunny Stream, YouTube, Vimeo) in an iframe, a direct file
 * in <video>. Renders nothing when there's no playable video, so callers show their own fallback.
 */
export default function VideoFrame({
  playback, title, className = "", videoRef, videoProps, allowFullscreen = true,
}: {
  playback?: Playback | null;
  title: string;
  className?: string;
  /** Off for students: the watermarked VideoShield provides full screen instead. */
  allowFullscreen?: boolean;
  videoRef?: Ref<HTMLVideoElement>;
  videoProps?: React.VideoHTMLAttributes<HTMLVideoElement>;
}) {
  if (!playback?.url) return null;
  if (isEmbedded(playback)) {
    return (
      <iframe
        src={playback.url}
        title={title}
        className={`border-0 bg-black ${className}`}
        loading="lazy"
        allow={`accelerometer; gyroscope; autoplay; encrypted-media${allowFullscreen ? "; picture-in-picture; fullscreen" : ""}`}
        allowFullScreen={allowFullscreen}
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }
  return (
    <video
      ref={videoRef}
      src={playback.url}
      controls
      controlsList={allowFullscreen ? "nodownload" : "nodownload nofullscreen noremoteplayback"}
      disablePictureInPicture={!allowFullscreen}
      className={`bg-black ${className}`}
      {...videoProps}
    />
  );
}
