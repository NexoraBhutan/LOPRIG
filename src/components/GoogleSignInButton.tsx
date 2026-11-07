"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useSiteConfig } from "@/lib/siteConfig";
import { homeFor } from "@/utils/routes";

// Google Identity Services, loaded from Google: https://developers.google.com/identity/gsi/web
interface GoogleId {
  initialize(options: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: "popup" }): void;
  renderButton(el: HTMLElement, options: Record<string, string | number>): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
let scriptLoad: Promise<void> | null = null;

function loadGoogle(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptLoad = null;
      reject(new Error("Couldn't load Google sign-in"));
    };
    document.head.appendChild(s);
  });
  return scriptLoad;
}

/**
 * "Continue with Google" for the login and sign-up pages. Signs in an existing account with the
 * same email (any role) or creates a student account, and brings in the Google profile picture.
 * Renders nothing until the backend has a GOOGLE_CLIENT_ID.
 */
export default function GoogleSignInButton({
  from,
  onError,
  text = "continue_with",
}: {
  /** Where to go after signing in (e.g. the page that sent them to log in). */
  from?: string | null;
  onError: (message: string, code?: string) => void;
  text?: "continue_with" | "signup_with" | "signin_with";
}) {
  const config = useSiteConfig();
  const clientId = config?.google_client_id;
  const { loginWithGoogle } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const slot = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // Keep the latest handlers without re-rendering Google's button on every keystroke.
  const handle = useRef<(credential: string) => void>(() => undefined);
  handle.current = async (credential: string) => {
    const res = await loginWithGoogle(credential);
    if (!res.ok) return onError(res.error, res.code);
    if (res.mustChangePassword) return router.replace("/set-password");
    push("Welcome to Lop-rig.", "success");
    router.push(from || homeFor(res.role));
  };

  useEffect(() => {
    if (!clientId || !slot.current) return;
    let alive = true;
    loadGoogle()
      .then(() => {
        if (!alive || !slot.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (r) => handle.current(r.credential),
          ux_mode: "popup",
        });
        window.google.accounts.id.renderButton(slot.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text,
          logo_alignment: "center",
          width: Math.min(slot.current.offsetWidth || 400, 400),
        });
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [clientId, text]);

  if (!clientId || failed) return null;

  return (
    <div className="flex flex-col gap-5 mb-5">
      <div ref={slot} className="flex justify-center min-h-[44px]" />
      <div className="flex items-center gap-3 text-xs text-ink-muted" aria-hidden="true">
        <span className="flex-1 h-px bg-line" />
        or use your email
        <span className="flex-1 h-px bg-line" />
      </div>
    </div>
  );
}
