/**
 * "Download for offline": lesson videos saved inside Lop-rig, never as a file on the device.
 *
 * The video is fetched once (a short-lived signed link from the API), encrypted with AES-GCM using a
 * key the browser generates as non-extractable (it can be used to decrypt here but never exported),
 * and kept in IndexedDB. It plays only through Lop-rig's player, decrypted into memory, and is removed
 * after the "keep until" date. Each signed-in student has their own key and copies.
 */
import { api } from "@/lib/api";

const DB_NAME = "loprig-offline";
const KEYS = "keys";
const VIDEOS = "videos";

interface StoredVideo {
  id: string; // `${userId}:${lessonId}`
  userId: string;
  lessonId: number;
  courseId: string;
  title: string;
  savedAt: number;
  keepUntil: number;
  size: number;
  iv: Uint8Array;
  data: ArrayBuffer;
}

export interface SavedLesson {
  lessonId: number;
  title: string;
  size: number;
  keepUntil: number;
}

interface DownloadLink {
  url: string;
  keep_until: string;
}

export function offlineSupported(): boolean {
  return typeof indexedDB !== "undefined" && typeof crypto !== "undefined" && !!crypto.subtle;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEYS)) db.createObjectStore(KEYS);
      if (!db.objectStoreNames.contains(VIDEOS)) db.createObjectStore(VIDEOS, { keyPath: "id" }).createIndex("byUser", "userId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(store: string, mode: IDBTransactionMode, body: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const req = body(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

/** This student's encryption key: created once, stored as a non-extractable CryptoKey. */
async function keyFor(userId: string): Promise<CryptoKey> {
  const existing = await run<CryptoKey | undefined>(KEYS, "readonly", (s) => s.get(userId));
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await run(KEYS, "readwrite", (s) => s.put(key, userId));
  return key;
}

const idFor = (userId: string, lessonId: number) => `${userId}:${lessonId}`;

/** Download, encrypt and save one lesson. `onProgress` gets 0..1 (or -1 when the size is unknown). */
export async function saveLesson({ userId, lessonId, courseId, title, onProgress, signal }: {
  userId: string;
  lessonId: number;
  courseId: string;
  title: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<SavedLesson> {
  const link = await api<DownloadLink>(`/learning/lessons/${lessonId}/download/`, { method: "POST" });
  const res = await fetch(link.url, { signal, referrerPolicy: "strict-origin-when-cross-origin" });
  if (!res.ok || !res.body) throw new Error("The video couldn't be downloaded. Please try again.");

  const total = Number(res.headers.get("Content-Length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(total ? received / total : -1);
  }
  const plain = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    plain.set(chunk, offset);
    offset += chunk.length;
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFor(userId), plain);
  const keepUntil = new Date(link.keep_until).getTime();
  const record: StoredVideo = {
    id: idFor(userId, lessonId), userId, lessonId, courseId, title, savedAt: Date.now(), keepUntil, size: received, iv, data,
  };
  await navigator.storage?.persist?.().catch(() => false);
  await run(VIDEOS, "readwrite", (s) => s.put(record));
  return { lessonId, title, size: received, keepUntil };
}

/** A playable link (in memory, this page only) for a saved lesson, or null. Expired copies are removed. */
export async function openLesson(userId: string, lessonId: number): Promise<string | null> {
  const record = await run<StoredVideo | undefined>(VIDEOS, "readonly", (s) => s.get(idFor(userId, lessonId)));
  if (!record) return null;
  if (record.keepUntil < Date.now()) {
    await removeLesson(userId, lessonId);
    return null;
  }
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(record.iv) }, await keyFor(userId), record.data);
  return URL.createObjectURL(new Blob([plain], { type: "video/mp4" }));
}

export function removeLesson(userId: string, lessonId: number): Promise<undefined> {
  return run(VIDEOS, "readwrite", (s) => s.delete(idFor(userId, lessonId)));
}

/** Lessons this student has saved for one course (expired ones left out). */
export async function savedLessons(userId: string, courseId: string): Promise<Map<number, SavedLesson>> {
  const all = await run<StoredVideo[]>(VIDEOS, "readonly", (s) => s.index("byUser").getAll(userId));
  const now = Date.now();
  return new Map(all
    .filter((v) => v.courseId === courseId && v.keepUntil >= now)
    .map((v) => [v.lessonId, { lessonId: v.lessonId, title: v.title, size: v.size, keepUntil: v.keepUntil }]));
}

export function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 * 1024
    ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}
