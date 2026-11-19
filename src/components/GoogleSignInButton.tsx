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

/** Google sign-in works only on https sites and on localhost (where the OAuth client lists them). */
function googleAllowedHere(): boolean {
  const { protocol, hostname } = window.location;
  return protocol === "https:" || hostname === "localhost" || hostname === "127.0.0.1";
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" className="flex-shrink-0 mt-0.5">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
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
  placement = "above",
}: {
  /** Where to go after signing in (e.g. the page that sent them to log in). */
  from?: string | null;
  onError: (message: string, code?: string) => void;
  text?: "continue_with" | "signup_with" | "signin_with";
  /** Whether the button sits above the email form or below it; the "or" divider goes between. */
  placement?: "above" | "below";
}) {
  const config = useSiteConfig();
  const clientId = config?.google_client_id;
  const { loginWithGoogle } = useAuth();
  const { push } = useToast();
  const router = useRouter();
  const slot = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  // Google only allows https sites and localhost. Opened by network address (e.g. 192.168.x.x),
  // its popup would just show "origin_mismatch", so explain instead. Known after mount.
  const [localhostUrl, setLocalhostUrl] = useState<string | null>(null);
  useEffect(() => {
    if (googleAllowedHere()) return;
    const { port, pathname, search } = window.location;
    setLocalhostUrl(`http://localhost${port ? `:${port}` : ""}${pathname}${search}`);
  }, []);

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
    if (!clientId || !slot.current || !googleAllowedHere()) return;
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

  const below = placement === "below";
  const divider = (
    <div className="flex items-center gap-3 text-xs text-ink-muted" aria-hidden="true">
      <span className="flex-1 h-px bg-line" />
      {below ? "or" : "or use your email"}
      <span className="flex-1 h-px bg-line" />
    </div>
  );

  return (
    <div className={`flex flex-col gap-5 ${below ? "mt-5" : "mb-5"}`}>
      {below && divider}
      {localhostUrl ? (
        <div role="note" className="flex items-start gap-3 rounded-2xl border-2 border-line bg-white px-4 py-3 text-sm text-ink">
          <GoogleMark />
          <p>
            <strong className="block text-ink-strong">Google sign-in isn&apos;t available at this address</strong>
            On this computer, open{" "}
            <a href={localhostUrl} className="font-bold text-gold-dark hover:text-gold">{new URL(localhostUrl).host}</a>{" "}
            instead. On other devices, use your email {below ? "above" : "below"}.
          </p>
        </div>
      ) : (
        <div ref={slot} className="flex justify-center min-h-[44px]" />
      )}
      {!below && divider}
    </div>
  );
}
