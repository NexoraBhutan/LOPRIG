/** Types and helpers for the teacher portal API (/api/v1/teach/...). */
import { ApiError } from "@/lib/api";

export type CourseStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED";
export type LessonKind = "VIDEO" | "TEXT" | "H5P";

export interface TeachResource {
  id: number;
  title: string;
  url: string;
}

export interface TeachLesson {
  id: number;
  title: string;
  order: number;
  kind: LessonKind;
  duration_seconds: number;
  is_preview: boolean;
  video_url: string;
  body: string;
  h5p_embed_url: string;
  resources: TeachResource[];
}

export interface TeachModule {
  id: number;
  title: string;
  order: number;
  lessons: TeachLesson[];
}

export interface TeachCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  language: string;
  price: number;
  discount_price: number | null;
  requirements: string[];
  what_you_learn: string[];
  thumbnail_url: string;
  gradient_start: string;
  gradient_end: string;
  status: CourseStatus;
  review_note: string;
  published_at: string | null;
  students_count: number;
  enrolled: number;
  lessons_count: number;
  duration: string;
  created_at: string;
  updated_at: string;
  modules?: TeachModule[];
  review_problems?: string[];
}

/** The editable subset of a course, as sent to the API. */
export type CourseInput = Pick<
  TeachCourse,
  | "title" | "description" | "category" | "level" | "language" | "price" | "discount_price"
  | "requirements" | "what_you_learn" | "gradient_start" | "gradient_end"
>;

export interface TeachSummary {
  courses: Record<CourseStatus | "total", number>;
  students: number;
  completions: number;
  revenue: number;
  recent_enrollments: { student: string; course: string; course_id: string; enrolled_at: string | null }[];
}

export interface TeachStudent {
  id: number;
  name: string;
  email: string;
  avatar_color: string;
  status: "ACTIVE" | "COMPLETED";
  progress: number;
  completed_lessons: number;
  activated_at: string | null;
  last_activity: string;
}

export const STATUS_META: Record<CourseStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-bg-sunken text-ink" },
  PENDING_REVIEW: { label: "In review", className: "bg-gold-soft text-gold-dark" },
  PUBLISHED: { label: "Published", className: "bg-emerald-50 text-emerald-700" },
  REJECTED: { label: "Needs changes", className: "bg-red-soft text-red-dark" },
};

export const LEVELS = ["Beginner", "Intermediate", "Advanced", "All Levels"] as const;

/** Text input styling shared by the teacher forms (matches the student site's forms). */
export const inputClass =
  "w-full px-4 py-3 bg-white border-2 border-line rounded-xl text-sm text-ink-strong placeholder:text-ink-muted focus:border-gold focus:outline-none transition-colors";

/** DRF validation errors -> { field: "first message" } for showing under inputs. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !err.data || typeof err.data !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(err.data as Record<string, unknown>)) {
    if (Array.isArray(value) && typeof value[0] === "string") out[key] = value[0];
    else if (typeof value === "string") out[key] = value;
  }
  return out;
}

/** "7:05" -> 425, "" -> 0. Accepts plain minutes ("12") too. */
export function parseDuration(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const [m, s = "0"] = trimmed.split(":");
  return Math.max(0, (Number(m) || 0) * 60 + (Number(s) || 0));
}

export function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatMoney(value: number): string {
  return `Nu. ${Math.round(value).toLocaleString()}`;
}

/** "3 days ago", "in 2 hours", "just now". */
export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
