"use client";

import { useRef, useState } from "react";
import { CheckCircle, CloudArrowDown, Spinner, Trash, X } from "@phosphor-icons/react";
import { errorMessage } from "@/lib/api";
import { formatSize, offlineSupported, removeLesson, saveLesson, type SavedLesson } from "@/lib/offline";

/**
 * "Download for offline" for one lesson: saves an encrypted copy inside Lop-rig (not as a file on
 * the device), so the lesson plays smoothly even on a slow connection.
 */
export default function OfflineButton({ userId, lessonId, courseId, title, saved, onChange }: {
  userId: string;
  lessonId: number;
  courseId: string;
  title: string;
  saved?: SavedLesson;
  onChange: (lessonId: number, saved: SavedLesson | null) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  if (!offlineSupported()) return null;

  const download = async () => {
    setError("");
    setProgress(0);
    abort.current = new AbortController();
    try {
      const result = await saveLesson({ userId, lessonId, courseId, title, onProgress: setProgress, signal: abort.current.signal });
      onChange(lessonId, result);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).name === "QuotaExceededError"
          ? "Not enough space on this device. Remove other downloaded lessons and try again."
          : errorMessage(err));
      }
    } finally {
      setProgress(null);
      abort.current = null;
    }
  };

  const remove = async () => {
    await removeLesson(userId, lessonId);
    onChange(lessonId, null);
  };

  if (progress !== null) {
    const pct = progress >= 0 ? Math.round(progress * 100) : null;
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-gold bg-gold-soft text-xs font-bold text-ink-strong">
        <Spinner size={14} className="animate-spin" />
        <span className="tabular-nums">Downloading… {pct !== null ? `${pct}%` : ""}</span>
        <span className="hidden sm:block w-20 h-1.5 rounded-full bg-white overflow-hidden" aria-hidden="true">
          <span className="block h-full bg-gold transition-all" style={{ width: `${pct ?? 30}%` }} />
        </span>
        <button type="button" onClick={() => abort.current?.abort()} aria-label="Cancel download" className="ml-1 text-ink-muted hover:text-ink-strong bg-transparent border-none cursor-pointer p-0">
          <X size={13} weight="bold" />
        </button>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700"
        title={`${formatSize(saved.size)}, kept in Lop-rig until ${new Date(saved.keepUntil).toLocaleDateString("en-GB")}`}>
        <CheckCircle size={15} weight="fill" />
        <span>Downloaded · plays without buffering</span>
        <button type="button" onClick={remove} aria-label="Remove the downloaded copy" title="Remove the downloaded copy"
          className="ml-1 text-emerald-700/70 hover:text-red-dark bg-transparent border-none cursor-pointer p-0">
          <Trash size={14} weight="bold" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        title="Save this video inside Lop-rig so it plays instantly next time, without buffering"
        className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-line bg-white text-xs font-bold text-ink-strong hover:border-gold cursor-pointer transition-colors"
      >
        <CloudArrowDown size={15} weight="bold" /> Download
      </button>
      {error && <span role="alert" className="text-[0.7rem] text-red-dark max-w-[240px] text-right">{error}</span>}
    </div>
  );
}
