"use client";

import { useRef, useState } from "react";
import { Camera } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, errorMessage } from "@/lib/api";
import ViewableAvatar from "@/components/ViewableAvatar";

const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];
const PHOTO_MAX_MB = 3;

/**
 * The signed-in person's photo (click to view it large) with "Add / Change photo" and "Remove".
 * `children` (e.g. name and email) sit beside the photo on wider screens, above the buttons.
 */
export default function ProfilePhotoPicker({
  size = "w-36 h-36 text-5xl",
  children,
}: {
  size?: string;
  children?: React.ReactNode;
}) {
  const { user, refreshUser } = useAuth();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  if (!user) return null;

  // A Google picture is a link to googleusercontent.com; an uploaded photo lives on our server.
  const hasOwnPhoto = Boolean(user.avatar) && !user.avatar.includes("googleusercontent.com");

  const send = async (method: "POST" | "DELETE", body?: FormData, done = "Profile photo updated") => {
    setBusy(true);
    try {
      await api("/users/me/avatar/", { method, body });
      await refreshUser();
      push(done, "success");
    } catch (err) {
      push(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // choosing the same file again should still work
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return push("Please choose a PNG, JPG or WebP image.", "error");
    if (file.size > PHOTO_MAX_MB * 1024 * 1024) return push(`That photo is too large. The limit is ${PHOTO_MAX_MB} MB.`, "error");
    const body = new FormData();
    body.append("image", file);
    send("POST", body);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
      <ViewableAvatar name={user.name} src={user.avatar} color={user.avatarColor} className={size}>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="absolute bottom-1 right-1 w-11 h-11 rounded-full flex items-center justify-center bg-ink-strong text-gold border-[3px] border-white shadow-md hover:bg-black transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          aria-label={user.avatar ? "Change photo" : "Add photo"}
          title={user.avatar ? "Change photo" : "Add photo"}
        >
          <Camera size={18} weight="fill" />
        </button>
      </ViewableAvatar>
      <input ref={input} type="file" accept={PHOTO_TYPES.join(",")} onChange={pick} className="sr-only" aria-label="Choose a profile photo" />
      <div className="flex flex-col items-center sm:items-start gap-4 text-center sm:text-left min-w-0">
      {children}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-strong bg-bg-soft border-2 border-line rounded-full px-3.5 py-1.5 hover:border-gold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
        >
          <Camera size={14} weight="bold" /> {busy ? "Saving…" : user.avatar ? "Change photo" : "Add photo"}
        </button>
        {hasOwnPhoto && (
          <button
            type="button"
            onClick={() => send("DELETE", undefined, "Profile photo removed")}
            disabled={busy}
            className="text-xs font-bold text-ink-muted hover:text-red-600 bg-transparent border-none px-2 py-1.5 cursor-pointer disabled:opacity-60"
          >
            Remove
          </button>
        )}
      </div>
      <p className="text-xs text-ink-muted">
        {user.avatar ? "Click your photo to see it full size. " : ""}PNG, JPG or WebP, up to {PHOTO_MAX_MB} MB.
      </p>
      </div>
    </div>
  );
}
