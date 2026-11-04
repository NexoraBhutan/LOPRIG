export type MascotPose = "idle" | "celebrate" | "thinking" | "sad";

export type ToastType = "success" | "error" | "info";

export type RingTone = "brand" | "flat";

export type LogoSize = "sm" | "md" | "lg";

export type LogoTone = "dark" | "light";

export type ProgressBarSize = "sm" | "md";

export type StatTone = "green" | "blue" | "gold";

export type IconName =
  | "Code"
  | "ChartBar"
  | "Calculator"
  | "Briefcase"
  | "Palette"
  | "Bullhorn"
  | "ShieldAlt"
  | "Globe"
  | "Language"
  | "Rocket";

export interface Lesson {
  id: string;
  title: string;
  duration: string;
}

export interface CurriculumSection {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Instructor {
  name: string;
  title: string;
}

export type CourseLevel = "Beginner" | "Intermediate" | "All Levels";

export type CategoryId =
  | "programming"
  | "data-science"
  | "mathematics"
  | "business"
  | "design"
  | "marketing"
  | "security"
  | "web-development"
  | "languages"
  | "entrepreneurship";

export interface Course {
  id: string;
  title: string;
  category: CategoryId;
  level: CourseLevel;
  description: string;
  instructor: Instructor;
  rating: number;
  students: number;
  duration: string;
  lessonsCount: number;
  price: number;
  discountPrice: number;
  language: string;
  bestseller: boolean;
  gradient: [string, string];
  requirements: string[];
  whatYouLearn: string[];
  curriculum: CurriculumSection[];
}

export interface Category {
  id: CategoryId;
  title: string;
  icon: IconName;
  count: number;
}

export interface Testimonial {
  name: string;
  role: string;
  quote: string;
}

export interface LearningPath {
  id: string;
  title: string;
  courseIds: string[];
  color: string;
}

export interface LessonSectionInput {
  title: string;
  lessons: string[];
}

/** A learner as it is stored in localStorage — no password. */
export type UserRole = "STUDENT" | "TEACHER" | "ADMIN";

export interface User {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  bio: string;
  avatarColor: string;
  joined: string;
  /** Still using a temporary password an admin gave them. */
  mustChangePassword: boolean;
}

/** A course the student is enrolled in and/or has saved. `enrolledAt` is null for saved-only courses. */
export interface EnrollmentRecord {
  courseId: string;
  status: "ACTIVE" | "COMPLETED" | null;
  enrolledAt: string | null;
  lastLesson: string | null;
  progress: number;
  saved: boolean;
}

export type EnrollmentMap = Record<string, EnrollmentRecord>;

export interface CourseProgress {
  course: Course;
  progress: number;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface Filters {
  categories: string[];
  levels: CourseLevel[];
  price: string;
  minRating: number;
}

export type SortOption = "popular" | "rating" | "newest" | "price-asc" | "price-desc";

export interface NavLinkItem {
  to: string;
  label: string;
}