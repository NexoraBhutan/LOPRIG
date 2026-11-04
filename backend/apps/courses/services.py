"""Course review workflow: teacher submits -> admin approves (published) or rejects (with a note)."""
from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.notifications.models import Notification
from apps.notifications.services import notify
from apps.users.models import User

from .models import Course, Lesson

SUBMITTABLE = (Course.Status.DRAFT, Course.Status.REJECTED)


def review_problems(course: Course) -> list[str]:
    """What still has to be filled in before a course can go to review."""
    problems = []
    if len(course.description.strip()) < 30:
        problems.append("Write a description of at least 30 characters.")
    if not course.what_you_learn:
        problems.append("Add at least one learning outcome.")
    lessons = Lesson.objects.filter(module__course=course)
    if not lessons.exists():
        problems.append("Add at least one lesson.")
    busy = lessons.filter(video_status__in=[Lesson.VideoStatus.UPLOADING, Lesson.VideoStatus.PROCESSING]).count()
    if busy:
        problems.append(f"Wait for {busy} video{'s' if busy > 1 else ''} to finish uploading and processing.")
    failed = lessons.filter(video_status=Lesson.VideoStatus.FAILED).count()
    if failed:
        problems.append(f"Upload {failed} failed video{'s' if failed > 1 else ''} again.")
    return problems


@transaction.atomic
def submit_for_review(course: Course) -> Course:
    if course.status not in SUBMITTABLE:
        raise ValidationError({"status": f"A {course.get_status_display().lower()} course can't be submitted."})
    problems = review_problems(course)
    if problems:
        raise ValidationError({"course": problems})
    course.status = Course.Status.PENDING_REVIEW
    course.save(update_fields=["status", "updated_at"])
    for admin in User.objects.filter(role=User.Role.ADMIN, is_active=True):
        notify(
            admin, Notification.Kind.SYSTEM, "Course submitted for review",
            f"{course.teacher.name} submitted “{course.title}”.",
            data={"course": course.slug},
        )
    return course


@transaction.atomic
def approve(course: Course) -> Course:
    course.publish()
    course.save()
    notify(
        course.teacher, Notification.Kind.SYSTEM, f"“{course.title}” is published",
        "Your course was approved and students can now enroll.",
        data={"course": course.slug, "url": f"{settings.FRONTEND_URL}/courses/{course.slug}"},
        email=True,
    )
    return course


@transaction.atomic
def reject(course: Course, note: str = "") -> Course:
    course.status = Course.Status.REJECTED
    course.review_note = note or course.review_note or "Please review the course and resubmit."
    course.save(update_fields=["status", "review_note", "updated_at"])
    notify(
        course.teacher, Notification.Kind.SYSTEM, f"“{course.title}” needs changes",
        course.review_note, data={"course": course.slug}, email=True,
    )
    return course
