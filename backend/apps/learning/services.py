from dataclasses import dataclass
from datetime import date, timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotAuthenticated, PermissionDenied

from apps.certificates.models import Certificate
from apps.certificates.services import issue_certificate
from apps.courses.models import Course, Lesson
from apps.enrollments.models import Enrollment
from apps.enrollments.services import enroll_free, get_access_enrollment
from apps.notifications.models import Notification
from apps.notifications.services import notify

from .models import ActivityDay, LessonProgress

XP_PER_LESSON = 10
XP_PER_COURSE = 100


@dataclass
class CourseProgress:
    completed_lessons: int
    total_lessons: int

    @property
    def percent(self) -> int:
        return round(100 * self.completed_lessons / self.total_lessons) if self.total_lessons else 0

    def as_dict(self) -> dict:
        return {
            "completed_lessons": self.completed_lessons,
            "total_lessons": self.total_lessons,
            "percent": self.percent,
        }


def is_open_course(course: Course) -> bool:
    """Free, admin-approved courses: anyone can watch every lesson, no enrollment or login needed."""
    return course.status == Course.Status.PUBLISHED and course.is_free


def require_access(student, course: Course) -> Enrollment:
    enrollment = get_access_enrollment(student, course)
    if enrollment is None and is_open_course(course):
        # Students on a free course are enrolled quietly, so progress and the certificate still work.
        enrollment, _ = enroll_free(student, course)
    if enrollment is None:
        raise PermissionDenied("Enroll in this course to access its lessons.")
    return enrollment


def check_lesson_access(user, lesson: Lesson) -> Enrollment | None:
    """Free published courses and preview lessons are open to everyone; the rest needs an enrollment."""
    course = lesson.module.course
    if is_open_course(course):
        return require_access(user, course) if user.is_authenticated and user.is_student else None
    if lesson.is_preview and course.status == Course.Status.PUBLISHED:
        if user.is_authenticated and user.is_student:
            return get_access_enrollment(user, course)
        return None
    if not user.is_authenticated:
        raise NotAuthenticated()
    if not user.is_student:
        raise PermissionDenied("Only student accounts can access lessons.")
    return require_access(user, course)


def course_progress(enrollment: Enrollment) -> CourseProgress:
    total = Lesson.objects.filter(module__course_id=enrollment.course_id).count()
    done = LessonProgress.objects.filter(
        enrollment=enrollment, completed=True, lesson__module__course_id=enrollment.course_id
    ).count()
    return CourseProgress(completed_lessons=done, total_lessons=total)


@transaction.atomic
def record_progress(student, lesson: Lesson, position_seconds: int | None = None, completed: bool = False):
    """Save a resume position and/or mark a lesson complete. Completion is one-way.

    Returns (lesson_progress, course_progress, certificate_or_None).
    """
    enrollment = require_access(student, lesson.module.course)
    enrollment = Enrollment.objects.select_for_update().get(pk=enrollment.pk)

    progress, _ = LessonProgress.objects.get_or_create(enrollment=enrollment, lesson=lesson)
    if position_seconds is not None:
        cap = lesson.duration_seconds or position_seconds
        progress.position_seconds = max(0, min(position_seconds, cap))
    newly_completed = completed and not progress.completed
    if newly_completed:
        progress.completed = True
        progress.completed_at = timezone.now()
    progress.save()

    enrollment.last_lesson = lesson
    enrollment.save(update_fields=["last_lesson", "updated_at"])
    ActivityDay.objects.get_or_create(student=student, day=timezone.localdate())

    certificate = complete_course_if_done(enrollment) if newly_completed else None
    return progress, course_progress(enrollment), certificate


def complete_course_if_done(enrollment: Enrollment) -> Certificate | None:
    stats = course_progress(enrollment)
    if stats.total_lessons == 0 or stats.completed_lessons < stats.total_lessons:
        return None
    just_completed = enrollment.status != Enrollment.Status.COMPLETED
    if just_completed:
        enrollment.status = Enrollment.Status.COMPLETED
        enrollment.completed_at = timezone.now()
        enrollment.save(update_fields=["status", "completed_at", "updated_at"])
    certificate, _ = issue_certificate(enrollment)
    if just_completed:
        course = enrollment.course
        notify(
            enrollment.student,
            Notification.Kind.COURSE_COMPLETED,
            f"You completed {course.title}!",
            f"Congratulations. Your certificate code is {certificate.code}.",
            data={"course": course.slug, "certificate": certificate.code},
            email=True,
        )
    return certificate


def day_streak(student, today: date | None = None) -> int:
    """Consecutive learning days ending today (or yesterday, so the streak survives until midnight)."""
    today = today or timezone.localdate()
    days = set(
        ActivityDay.objects.filter(student=student, day__gte=today - timedelta(days=366)).values_list("day", flat=True)
    )
    cursor = today if today in days else today - timedelta(days=1)
    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def learning_summary(student) -> dict:
    enrollments = Enrollment.objects.filter(student=student, status__in=Enrollment.ACCESS_STATUSES)
    completed_courses = enrollments.filter(status=Enrollment.Status.COMPLETED).count()
    completed_lessons = LessonProgress.objects.filter(enrollment__in=enrollments, completed=True).count()
    return {
        "enrolled_courses": enrollments.count(),
        "completed_courses": completed_courses,
        "completed_lessons": completed_lessons,
        "certificates": Certificate.objects.filter(student=student).count(),
        "streak": day_streak(student),
        "xp": completed_lessons * XP_PER_LESSON + completed_courses * XP_PER_COURSE,
    }
