/** Types and labels for the admin portal API (/api/v1/manage/...). */
import type { CourseStatus, TeachModule } from "@/lib/teach";
import type { UserRole } from "@/types";

export interface AdminSummary {
  totals: {
    students: number;
    students_30d: number;
    teachers: number;
    admins: number;
    courses: Record<CourseStatus, number>;
    enrollments: number;
    enrollments_30d: number;
    completions: number;
    completion_rate: number;
    certificates: number;
    revenue: number;
    revenue_30d: number;
    failed_payments_30d: number;
    /** Bank QR payments waiting for an admin to check them. */
    payments_to_verify: number;
  };
  series: { date: string; signups: number; enrollments: number; revenue: number }[];
  top_courses: { id: string; title: string; teacher: string; enrolled: number; completion_rate: number }[];
  pending_review: AdminCourse[];
  recent_payments: AdminPayment[];
}

export interface AdminCourse {
  id: string;
  title: string;
  teacher: string;
  teacher_email: string;
  category: string;
  level: string;
  status: CourseStatus;
  review_note: string;
  price: number;
  enrolled: number;
  completed: number;
  lessons_count: number;
  duration: string;
  gradient_start: string;
  gradient_end: string;
  published_at: string | null;
  updated_at: string;
}

export interface AdminCourseDetail extends AdminCourse {
  description: string;
  language: string;
  what_you_learn: string[];
  requirements: string[];
  modules: TeachModule[];
  review_problems: string[];
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  headline: string;
  is_active: boolean;
  avatar_color: string;
  avatar: string;
  date_joined: string;
  last_login: string | null;
  enrollments: number;
  courses: number;
  must_change_password: boolean;
  password_changed_at: string | null;
  /** Only after creating the account or emailing new login details: did the email go out? */
  email_sent?: boolean;
}

export type EnrollmentStatus = "PENDING_PAYMENT" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface AdminEnrollment {
  id: number;
  student: string;
  student_email: string;
  course: string;
  course_id: string;
  status: EnrollmentStatus;
  progress: number;
  completed_lessons: number;
  total_lessons: number;
  activated_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface AdminPayment {
  reference: string;
  student: string;
  student_email: string;
  course: string;
  course_id: string;
  amount: number;
  currency: string;
  provider: string;
  status: PaymentStatus;
  failure_reason: string;
  /** Bank QR payments: the receipt's journal number and whether a screenshot was attached. */
  journal_number: string;
  contact_number: string;
  has_proof: boolean;
  /** Paid from a bank account (RMA gateway): which bank and account. Null for QR payments. */
  bank: { name: string; account_last4: string; purpose: string; remarks: string; test: boolean } | null;
  reviewed_by: string;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface AdminQrSettings {
  ready: boolean;
  qr_image_url: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  instructions: string;
  /** Gets an email the moment a student submits a payment (empty = all admins). */
  alert_email: string;
  updated_at: string;
}

type Meta = { label: string; className: string };

export const ROLE_META: Record<UserRole, Meta> = {
  STUDENT: { label: "Student", className: "bg-bg-sunken text-ink" },
  TEACHER: { label: "Teacher", className: "bg-gold-soft text-gold-dark" },
  ADMIN: { label: "Admin", className: "bg-ink-strong text-gold" },
};

export const ENROLLMENT_META: Record<EnrollmentStatus, Meta> = {
  ACTIVE: { label: "Learning", className: "bg-gold-soft text-gold-dark" },
  COMPLETED: { label: "Completed", className: "bg-emerald-50 text-emerald-700" },
  PENDING_PAYMENT: { label: "Awaiting payment", className: "bg-bg-sunken text-ink" },
  CANCELLED: { label: "Cancelled", className: "bg-red-soft text-red-dark" },
};

export const PAYMENT_META: Record<PaymentStatus, Meta> = {
  SUCCEEDED: { label: "Paid", className: "bg-emerald-50 text-emerald-700" },
  PENDING: { label: "To verify", className: "bg-gold-soft text-gold-dark" },
  FAILED: { label: "Failed", className: "bg-red-soft text-red-dark" },
  CANCELLED: { label: "Cancelled", className: "bg-bg-sunken text-ink" },
};

export function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}
