"""Gentle reminders, in the app and by email.

- Students: a course they started but haven't opened for a couple of days ("continue learning").
- Teachers: students' written quiz answers waiting more than a day to be marked.
- Admins: courses waiting for review and payments waiting to be verified for more than a day.

The daily `python manage.py send_reminders` job sends all of them by email (and to the bell).
Students who are on the site also get theirs in the bell without email (services.remind_to_continue).
Each reminder is recorded as a REMINDER notification, which is how repeats are avoided.
"""
from datetime import timedelta

from django.conf import settings
from django.db.models import Max
from django.utils import timezone

from apps.courses.models import Course
from apps.enrollments.models import Enrollment
from apps.notifications.models import Notification
from apps.notifications.services import notify
from apps.payments.models import Payment
from apps.users.models import User

from .models import QuizAttempt
from .services import course_progress

STUDENT_IDLE_DAYS = 2  # remind after this many days without opening the course
STUDENT_GAP_DAYS = 3  # at most one reminder per course in this many days
WAITING_HOURS = 24  # teachers and admins hear about things waiting longer than this
DIGEST_GAP_HOURS = 20  # at most one teacher/admin reminder a day (a little slack for the job's timing)


def _site(path: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def _reminded_since(user, since, **data) -> bool:
    """Has this user had a REMINDER (optionally with these data values) since then?"""
    filters = {f"data__{k}": v for k, v in data.items()}
    return Notification.objects.filter(user=user, kind=Notification.Kind.REMINDER, created_at__gte=since,
                                       **filters).exists()


def remind_student(student, *, email: bool) -> Notification | None:
    """Remind a student of the course they were most recently in, if it's been idle a while.

    At most one reminder per course every few days, none for finished courses, and at most one
    per call so nobody gets a pile of them at once.
    """
    now = timezone.now()
    enrollments = (
        Enrollment.objects.filter(student=student, status=Enrollment.Status.ACTIVE)
        .select_related("course", "last_lesson")
        .annotate(last_seen=Max("lesson_progress__updated_at"))
        .order_by("-updated_at")
    )
    for enrollment in enrollments:
        course = enrollment.course
        last_seen = enrollment.last_seen or enrollment.activated_at
        if not last_seen or now - last_seen < timedelta(days=STUDENT_IDLE_DAYS):
            continue
        if _reminded_since(student, now - timedelta(days=STUDENT_GAP_DAYS), course=course.slug):
            continue
        progress = course_progress(enrollment)
        if progress.finished:
            continue
        return _student_reminder(student, enrollment, progress.percent, email)
    return None


def _student_reminder(student, enrollment: Enrollment, percent: int, email: bool) -> Notification:
    course = enrollment.course
    lesson = enrollment.last_lesson
    if percent:
        message = (f"You're {percent}% through. Pick up with “{lesson.title}”." if lesson
                   else f"You're {percent}% through. A few minutes today keeps your streak going.")
        progress_line = (
            f"You've already completed {percent}% of the course, which is wonderful progress. "
            + (f"Your next step is “{lesson.title}”." if lesson else "Your next lesson is ready for you.")
        )
    else:
        message = "Your first lesson is waiting. It only takes a few minutes to get started."
        progress_line = "Your first lesson is ready and waiting. It only takes a few minutes to get started."
    path = f"/learn/{course.slug}" + (f"?lesson={lesson.id}" if lesson else "")
    return notify(
        student, Notification.Kind.REMINDER, f"Continue {course.title}", message,
        data={"course": course.slug, **({"lesson": lesson.id} if lesson else {})},
        email=email,
        email_body=[
            f"We hope you're doing well! It's been a few days since you last opened “{course.title}”, "
            "so we wanted to send you a gentle reminder that your learning is right where you left it.",
            progress_line,
            "Even ten or fifteen minutes today can make a real difference. Learning a little every day "
            "is the surest way to reach your goals, and we're cheering you on all the way.",
            "If now isn't a good time, no worries at all: your course will be here whenever you're ready.",
        ],
        email_button=("Continue learning", _site(path)),
    )


def remind_teacher(teacher) -> Notification | None:
    """Tell a teacher how many students have been waiting over a day for their answers to be marked."""
    now = timezone.now()
    waiting = QuizAttempt.objects.filter(
        quiz__module__course__teacher=teacher, status=QuizAttempt.Status.PENDING,
        created_at__lte=now - timedelta(hours=WAITING_HOURS),
    )
    count = waiting.count()
    if not count or _reminded_since(teacher, now - timedelta(hours=DIGEST_GAP_HOURS), digest="reviews"):
        return None
    students = waiting.values("enrollment__student").distinct().count()
    people = "1 student is" if students == 1 else f"{students} students are"
    tests = "1 chapter quiz" if count == 1 else f"{count} chapter quizzes"
    return notify(
        teacher, Notification.Kind.REMINDER, f"{people} waiting for your feedback",
        f"{tests} with written answers to mark.",
        data={"digest": "reviews", "link": "/teach/reviews"},
        email=True,
        email_body=[
            f"Thank you for the care you put into teaching on Lop-rig. {people.capitalize()} waiting for you "
            f"to mark their written answers ({tests}).",
            "Your students can't finish the chapter until their answers are reviewed, and a few words of "
            "feedback from you mean a great deal to them.",
            "It usually takes just a minute or two per student. Thank you so much for helping them keep going!",
        ],
        email_button=("Review answers", _site("/teach/reviews")),
    )


def remind_admin(admin) -> Notification | None:
    """Tell an admin about courses and payments that have been waiting for them over a day."""
    now = timezone.now()
    before = now - timedelta(hours=WAITING_HOURS)
    courses = Course.objects.filter(status=Course.Status.PENDING_REVIEW, updated_at__lte=before).count()
    payments = Payment.objects.filter(status=Payment.Status.PENDING, created_at__lte=before).exclude(
        journal_number="").count()
    if not (courses or payments) or _reminded_since(admin, now - timedelta(hours=DIGEST_GAP_HOURS), digest="admin"):
        return None
    parts = []
    if courses:
        parts.append("1 course waiting for review" if courses == 1 else f"{courses} courses waiting for review")
    if payments:
        parts.append("1 payment to verify" if payments == 1 else f"{payments} payments to verify")
    summary = " and ".join(parts)
    link = "/admin/courses?status=PENDING_REVIEW" if courses else "/admin/payments"
    return notify(
        admin, Notification.Kind.REMINDER, f"Waiting for you: {summary}",
        "Teachers and students are waiting on these. Thank you for taking a look.",
        data={"digest": "admin", "link": link},
        email=True,
        email_body=[
            f"Here's a friendly summary of what's waiting on Lop-rig: {summary}.",
            "Teachers are keen to see their courses go live, and students who have paid are waiting to "
            "start learning, so a quick look would mean a lot to them.",
            "Thank you for keeping everything running smoothly!",
        ],
        email_button=("Open the admin portal", _site(link)),
    )


def send_all() -> dict:
    """Run every reminder once. Returns how many were sent to each group."""
    students = User.objects.filter(
        role=User.Role.STUDENT, is_active=True, enrollments__status=Enrollment.Status.ACTIVE,
    ).distinct()
    teachers = User.objects.filter(role=User.Role.TEACHER, is_active=True)
    admins = User.objects.filter(role=User.Role.ADMIN, is_active=True)
    return {
        "students": sum(1 for s in students if remind_student(s, email=True)),
        "teachers": sum(1 for t in teachers if remind_teacher(t)),
        "admins": sum(1 for a in admins if remind_admin(a)),
    }
