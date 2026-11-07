"use client";

import { useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { UploadSimple, ArrowsClockwise, Trash, Warning, CircleNotch, CheckCircle, X } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import type { TeachLesson } from "@/lib/teach";
import VideoFrame from "@/components/VideoFrame";

type Run = (action: () => Promise<unknown>, success?: string) => Promise<boolean>;

interface UploadTicket {
  endpoint: string;
  library_id: string;
  video_id: string;
  signature: string;
  expires: number;
  max_bytes: number;
}

const MAX_MB = 2048; // matches the server's VIDEO_MAX_UPLOAD_MB default; the server ticket has the real limit
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes > 100 * 1024 * 1024 ? 0 : 1)} MB`;

/**
 * Upload a lesson video straight from the browser to Bunny Stream (resumable, so a flaky
 * connection retries instead of starting over). The file never passes through our server.
 */
export default function VideoUpload({
  lesson, run, initialFile, onInitialFileTaken,
}: {
  lesson: TeachLesson;
  run: Run;
  /** A file the teacher picked before the lesson existed: upload it as soon as this mounts. */
  initialFile?: File | null;
  onInitialFileTaken?: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<tus.Upload | null>(null);
  const initialStarted = useRef(false);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const uploading = progress !== null;
  const status = lesson.video_status;

  // Leaving the page mid-upload would lose it: let the browser ask first.
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploading]);

  const start = async (file: File) => {
    setError("");
    if (!file.type.startsWith("video/")) return setError("Choose a video file (MP4, MOV or WebM).");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`That file is ${mb(file.size)}. The limit is ${MAX_MB / 1024} GB.`);

    let ticket: UploadTicket | null = null;
    const ok = await run(async () => {
      ticket = (await api<{ upload: UploadTicket }>(`/teach/lessons/${lesson.id}/video/upload/`, { method: "POST" })).upload;
    });
    if (!ok || !ticket) return;
    const t: UploadTicket = ticket;
    if (file.size > t.max_bytes) {
      await run(() => api(`/teach/lessons/${lesson.id}/video/`, { method: "DELETE" }));
      return setError(`That file is ${mb(file.size)}. The limit is ${mb(t.max_bytes)}.`);
    }

    setProgress({ sent: 0, total: file.size });
    const upload = new tus.Upload(file, {
      endpoint: t.endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
      chunkSize: 50 * 1024 * 1024,
      storeFingerprintForResuming: false,
      headers: {
        AuthorizationSignature: t.signature,
        AuthorizationExpire: String(t.expires),
        VideoId: t.video_id,
        LibraryId: t.library_id,
      },
      metadata: { filetype: file.type, title: lesson.title },
      onProgress: (sent, total) => setProgress({ sent, total }),
      onError: (err) => {
        uploadRef.current = null;
        setProgress(null);
        setError(`Upload stopped: ${err.message.split("\n")[0]}. Check your connection and try again.`);
      },
      onSuccess: () => {
        uploadRef.current = null;
        setProgress(null);
        // Bunny starts processing now; checking once flips the status to "Processing" right away.
        run(() => api(`/teach/lessons/${lesson.id}/video/`, { method: "POST" }), "Video uploaded. Processing has started.");
      },
    });
    uploadRef.current = upload;
    upload.start();
  };

  useEffect(() => {
    if (!initialFile || initialStarted.current) return;
    initialStarted.current = true;
    onInitialFileTaken?.();
    start(initialFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once, for the file picked before saving
  }, [initialFile]);

  const cancel = async () => {
    await uploadRef.current?.abort(true).catch(() => undefined);
    uploadRef.current = null;
    setProgress(null);
    await run(() => api(`/teach/lessons/${lesson.id}/video/`, { method: "DELETE" }), "Upload cancelled");
  };

  const remove = () => run(() => api(`/teach/lessons/${lesson.id}/video/`, { method: "DELETE" }), "Video removed");
  const choose = () => fileInput.current?.click();

  const picker = (
    <input
      ref={fileInput}
      type="file"
      accept="video/mp4,video/quicktime,video/webm,video/*"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) start(file);
      }}
    />
  );

  if (uploading) {
    const percent = progress.total ? Math.round((progress.sent / progress.total) * 100) : 0;
    return (
      <div className="rounded-2xl border border-line bg-white p-4" aria-live="polite">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-semibold text-ink-strong">Uploading… {percent}%</p>
          <button type="button" onClick={cancel} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-red-dark bg-transparent border-none cursor-pointer">
            <X size={12} weight="bold" /> Cancel
          </button>
        </div>
        <div className="h-2 rounded-full bg-bg-sunken overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
          <div className="h-full bg-gold rounded-full transition-[width] duration-300" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-xs text-ink-muted mt-2">{mb(progress.sent)} of {mb(progress.total)} · Keep this tab open until it finishes.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {picker}

      {lesson.has_upload && status === "READY" && (
        <div className="rounded-2xl overflow-hidden border border-line bg-black">
          <VideoFrame playback={lesson.playback} title={`Preview of ${lesson.title}`} className="w-full aspect-video" />
        </div>
      )}

      {lesson.has_upload && status === "PROCESSING" && (
        <StatusBox tone="info" icon={<CircleNotch size={18} className="animate-spin" />}>
          <strong>Processing your video.</strong> This usually takes a few minutes, and you can keep editing meanwhile.
        </StatusBox>
      )}
      {lesson.has_upload && status === "UPLOADING" && (
        <StatusBox tone="warn" icon={<Warning size={18} weight="fill" />}>
          <strong>The upload didn&apos;t finish.</strong> Choose the file again to upload it.
        </StatusBox>
      )}
      {lesson.has_upload && status === "FAILED" && (
        <StatusBox tone="error" icon={<Warning size={18} weight="fill" />}>
          <strong>This video couldn&apos;t be processed.</strong> Try exporting it as MP4 and upload again.
        </StatusBox>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={choose} className="btn btn-md btn-outline inline-flex items-center gap-2">
          {lesson.has_upload ? <ArrowsClockwise size={15} /> : <UploadSimple size={15} />}
          {lesson.has_upload ? "Replace video" : "Upload video"}
        </button>
        {lesson.has_upload && (
          <button type="button" onClick={remove} className="btn btn-md btn-outline-neutral inline-flex items-center gap-2">
            <Trash size={15} /> Remove
          </button>
        )}
        {lesson.has_upload && status === "READY" && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle size={14} weight="fill" /> Ready for students</span>
        )}
        {!lesson.has_upload && <span className="text-xs text-ink-muted">MP4, MOV or WebM, up to {MAX_MB / 1024} GB.</span>}
      </div>

      {error && <p role="alert" className="text-sm text-red-dark">{error}</p>}
    </div>
  );
}

function StatusBox({ tone, icon, children }: { tone: "info" | "warn" | "error"; icon: React.ReactNode; children: React.ReactNode }) {
  const styles = {
    info: "bg-gold-soft/60 text-ink",
    warn: "bg-gold-soft text-ink-strong",
    error: "bg-red-soft text-red-dark",
  }[tone];
  return (
    <div className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${styles}`} role="status">
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  );
}
