/**
 * API (snake_case, numeric ids) -> the frontend types the views already use.
 * Keeping this in one place means pages don't need to know the API's shape.
 */
import type { Category, CategoryId, Course, CourseLevel, CurriculumSection, IconName, User, UserRole } from "@/types";

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: string;
  headline?: string;
  bio: string;
  avatar_color: string;
  avatar?: string;
  joined: string;
  must_change_password?: boolean;
  has_password?: boolean;
  password_changed_at?: string | null;
}

export interface ApiCategory {
  id: string;
  title: string;
  icon: string;
  count: number;
}

export interface ApiLessonOutline {
  id: number;
  title: string;
  kind: string;
  duration: string;
  duration_seconds: number;
  is_preview: boolean;
}

export interface ApiModule<L = ApiLessonOutline> {
  id: number;
  title: string;
  lessons: L[];
}

export interface ApiCourse {
  id: string;
  title: string;
  category: string;
  level: string;
  description: string;
  instructor: { name: string; title: string; avatar?: string };
  rating: number;
  students: number;
  duration: string;
  lessons_count: number;
  price: number;
  discount_price: number;
  language: string;
  bestseller: boolean;
  gradient: [string, string];
  thumbnail_url: string;
  requirements?: string[];
  what_you_learn?: string[];
  curriculum?: ApiModule[];
}

export function toUser(u: ApiUser): User {
  return {
    id: String(u.id),
    role: u.role as UserRole,
    name: u.name,
    email: u.email,
    headline: u.headline ?? "",
    bio: u.bio,
    avatarColor: u.avatar_color,
    avatar: u.avatar ?? "",
    joined: u.joined,
    mustChangePassword: Boolean(u.must_change_password),
    hasPassword: u.has_password ?? true,
    passwordChangedAt: u.password_changed_at ?? null,
  };
}

export function toCategory(c: ApiCategory): Category {
  return { id: c.id as CategoryId, title: c.title, icon: c.icon as IconName, count: c.count };
}

export function toSections(modules: ApiModule<{ id: number; title: string; duration: string }>[]): CurriculumSection[] {
  return modules.map((m) => ({
    id: String(m.id),
    title: m.title,
    lessons: m.lessons.map((l) => ({ id: String(l.id), title: l.title, duration: l.duration })),
  }));
}

export function toCourse(c: ApiCourse): Course {
  return {
    id: c.id,
    title: c.title,
    category: c.category as CategoryId,
    level: c.level as CourseLevel,
    description: c.description,
    instructor: c.instructor,
    rating: c.rating,
    students: c.students,
    duration: c.duration,
    lessonsCount: c.lessons_count,
    price: c.price,
    discountPrice: c.discount_price,
    language: c.language,
    bestseller: c.bestseller,
    gradient: c.gradient,
    thumbnail: c.thumbnail_url || undefined,
    requirements: c.requirements ?? [],
    whatYouLearn: c.what_you_learn ?? [],
    curriculum: c.curriculum ? toSections(c.curriculum) : [],
  };
}

/** "12h 30m" / "45m" -> hours as a number. */
export function durationToHours(duration: string): number {
  const hours = /(\d+)\s*h/.exec(duration)?.[1];
  const minutes = /(\d+)\s*m/.exec(duration)?.[1];
  return Number(hours ?? 0) + Number(minutes ?? 0) / 60;
}
