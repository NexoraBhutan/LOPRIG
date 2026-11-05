/**
 * Thin client for the Django API.
 *
 * The access token lives only in memory. The refresh token is kept in
 * localStorage so a reload keeps you signed in; on a 401 the client swaps it
 * for a new access token once and retries the request.
 */
import { safeGetItem, safeRemoveItem, safeSetItem } from "@/utils/storage";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

/** Uploaded files can come back as "/media/…"; those live on the API's server, not this site. */
export function mediaUrl(url: string | null | undefined): string {
  if (!url) return "";
  return url.startsWith("/") ? `${new URL(API_URL).origin}${url}` : url;
}

const REFRESH_KEY = "loprig_refresh";

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let onAuthLost: (() => void) | null = null;

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown, message: string) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  safeSetItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  accessToken = null;
  safeRemoveItem(REFRESH_KEY);
}

export function getRefreshToken(): string | null {
  return safeGetItem(REFRESH_KEY);
}

/** Called when the session can no longer be refreshed, so the UI can sign the user out. */
export function setAuthLostHandler(handler: (() => void) | null): void {
  onAuthLost = handler;
}

/** Swap the stored refresh token for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = getRefreshToken();
  if (!refresh) return Promise.resolve(false);

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      const data = (await res.json()) as { access: string; refresh?: string };
      setTokens(data.access, data.refresh ?? refresh); // refresh tokens rotate
      return true;
    } catch {
      return false; // network error: keep the refresh token and try again later
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** JSON-serialisable data, or FormData for file uploads (the browser sets its content type). */
  body?: unknown;
}

/** Fetch with the session's token, refreshing it once if it has expired. */
async function authorizedFetch(path: string, method: string, body: unknown): Promise<Response> {
  const send = () => {
    const headers: Record<string, string> = { Accept: "application/json" };
    const isForm = body instanceof FormData;
    if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(path.startsWith("http") ? path : `${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  };

  let res: Response;
  try {
    res = await send();
    if (res.status === 401 && getRefreshToken()) {
      if (await refreshSession()) {
        res = await send();
      } else if (!getRefreshToken()) {
        onAuthLost?.();
      }
    }
  } catch {
    throw new ApiError(0, null, "Can't reach the Lop-rig server. Check your connection and try again.");
  }
  return res;
}

export async function api<T = unknown>(path: string, { method = "GET", body }: RequestOptions = {}): Promise<T> {
  const res = await authorizedFetch(path, method, body);
  const data = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (!res.ok) throw new ApiError(res.status, data, messageFrom(data) ?? `Request failed (${res.status}).`);
  return data as T;
}

/** GET a private file (e.g. a payment screenshot) that needs the login token, as a Blob. */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await authorizedFetch(path, "GET", undefined);
  if (!res.ok) {
    const data = await res.json().catch(() => undefined);
    throw new ApiError(res.status, data, messageFrom(data) ?? `Request failed (${res.status}).`);
  }
  return res.blob();
}

interface Page<T> {
  next: string | null;
  results: T[];
}

/** GET every page of a paginated list endpoint. */
export async function apiAll<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let url: string | null = path;
  while (url) {
    const page: Page<T> = await api<Page<T>>(url);
    items.push(...page.results);
    url = page.next;
  }
  return items;
}

/** Best human-readable message from a DRF error body: `detail`, else the first field error. */
function messageFrom(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  if (typeof record.detail === "string") return record.detail;
  for (const value of Object.values(record)) {
    if (typeof value === "string") return value;
    if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  }
  return undefined;
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
