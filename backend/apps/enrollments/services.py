from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from apps.courses.models import Course
from apps.notifications.models import Notification
from apps.notifications.services import notify

from .models import Enrollment


class AlreadyEnrolled(APIException):
    status_code = 409
    default_detail = "You are already enrolled in this course."
    default_code = "already_enrolled"


class PaymentRequired(APIException):
    status_code = 402
    default_detail = "This course is paid. Start a checkout to enroll."
    default_code = "payment_required"


def get_access_enrollment(student, course) -> Enrollment | None:
    return Enrollment.objects.filter(
        student=student, course=course, status__in=Enrollment.ACCESS_STATUSES
    ).first()


def enroll_free(student, course: Course) -> tuple[Enrollment, bool]:
    """Enroll in a free course. Idempotent; returns (enrollment, newly_granted_access)."""
    if not course.is_free:
        raise PaymentRequired()
    with transaction.atomic():
        enrollment, _ = Enrollment.objects.select_for_update().get_or_create(student=student, course=course)
        if enrollment.has_access:
            return enrollment, False
        enrollment = activate(enrollment)
    return enrollment, True


def get_or_create_pending(student, course: Course) -> Enrollment:
    """Used by checkout, inside its transaction. Refuses if the student already has access."""
    if course.is_free:
        raise ValidationError({"course": "This course is free; enroll directly."})
    enrollment, _ = Enrollment.objects.select_for_update().get_or_create(student=student, course=course)
    if enrollment.has_access:
        raise AlreadyEnrolled()
    if enrollment.status != Enrollment.Status.PENDING_PAYMENT:
        enrollment.status = Enrollment.Status.PENDING_PAYMENT
        enrollment.save(update_fields=["status", "updated_at"])
    return enrollment


@transaction.atomic
def activate(enrollment: Enrollment) -> Enrollment:
    """Grant course access. Safe to call twice: only the first call changes anything."""
    enrollment = Enrollment.objects.select_for_update().select_related("course", "student").get(pk=enrollment.pk)
    if enrollment.has_access:
        return enrollment
    enrollment.status = Enrollment.Status.ACTIVE
    enrollment.activated_at = timezone.now()
    enrollment.save(update_fields=["status", "activated_at", "updated_at"])
    Course.objects.filter(pk=enrollment.course_id).update(students_count=F("students_count") + 1)
    course = enrollment.course
    notify(
        enrollment.student,
        Notification.Kind.ENROLLMENT,
        f"You're enrolled in {course.title}",
        "Your course is unlocked. Start learning whenever you're ready.",
        data={"course": course.slug},
        email=True,
        email_body=[
            f"Welcome to “{course.title}”! You're now enrolled, and every lesson is unlocked and ready for you.",
            "Learn at your own pace: even a few minutes a day adds up faster than you think. When you "
            "finish every lesson, you'll earn your certificate.",
            "We're so glad you're here. Happy learning!",
        ],
        email_button=("Start learning", f"{settings.FRONTEND_URL.rstrip('/')}/learn/{course.slug}"),
    )
    # The teacher hears about each new student in the app (no email, so busy courses don't flood their inbox).
    notify(
        course.teacher,
        Notification.Kind.ENROLLMENT,
        f"New student in {course.title}",
        f"{enrollment.student.name} just enrolled.",
        data={"course": course.slug},
    )
    return enrollment
