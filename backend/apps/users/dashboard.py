"""Data for the Django Admin home page (wired up via UNFOLD["DASHBOARD_CALLBACK"])."""
from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.urls import reverse
from django.utils import timezone

from apps.certificates.models import Certificate
from apps.courses.models import Course
from apps.enrollments.models import Enrollment
from apps.payments.models import Payment

from .models import User


def pending_courses_badge(request) -> str:
    """Sidebar badge on "Courses": how many are waiting for review."""
    count = Course.objects.filter(status=Course.Status.PENDING_REVIEW).count()
    return str(count) if count else ""


def _money(value) -> str:
    return f"Nu. {value or 0:,.0f}"


def dashboard_callback(request, context):
    now = timezone.now()
    month_ago = now - timedelta(days=30)

    students = User.objects.filter(role=User.Role.STUDENT)
    access = Enrollment.objects.filter(status__in=Enrollment.ACCESS_STATUSES)
    paid = Payment.objects.filter(status=Payment.Status.SUCCEEDED)
    pending = (
        Course.objects.filter(status=Course.Status.PENDING_REVIEW)
        .select_related("teacher", "category")
        .order_by("updated_at")
    )

    kpis = [
        {"label": "Students", "icon": "school", "value": f"{students.count():,}",
         "hint": f"+{students.filter(date_joined__gte=month_ago).count()} in the last 30 days"},
        {"label": "Teachers", "icon": "co_present",
         "value": f"{User.objects.filter(role=User.Role.TEACHER).count():,}", "hint": "Created by admins"},
        {"label": "Published courses", "icon": "menu_book",
         "value": f"{Course.objects.published().count():,}", "hint": f"{pending.count()} awaiting review",
         "accent": pending.exists()},
        {"label": "Enrollments", "icon": "how_to_reg", "value": f"{access.count():,}",
         "hint": f"+{access.filter(activated_at__gte=month_ago).count()} in the last 30 days"},
        {"label": "Revenue", "icon": "payments", "value": _money(paid.aggregate(s=Sum("amount"))["s"]),
         "hint": f"{_money(paid.filter(paid_at__gte=month_ago).aggregate(s=Sum('amount'))['s'])} in the last 30 days"},
        {"label": "Certificates", "icon": "workspace_premium", "value": f"{Certificate.objects.count():,}",
         "hint": "Issued on course completion"},
    ]

    # Sign-ups per day for the last 14 days, as bar heights (0-100).
    start = timezone.localdate() - timedelta(days=13)  # local (Thimphu) days, matching TruncDate
    per_day = dict(
        students.filter(date_joined__date__gte=start)
        .annotate(day=TruncDate("date_joined"))
        .values("day")
        .annotate(n=Count("id"))
        .values_list("day", "n")
    )
    days = [start + timedelta(days=i) for i in range(14)]
    peak = max(per_day.values(), default=0) or 1
    signups = [
        {"label": d.strftime("%d %b"), "count": per_day.get(d, 0), "height": round(100 * per_day.get(d, 0) / peak)}
        for d in days
    ]

    top = (
        Course.objects.published()
        .annotate(enrolled=Count("enrollments", filter=Q(enrollments__status__in=Enrollment.ACCESS_STATUSES)))
        .select_related("teacher")
        .order_by("-enrolled", "title")[:5]
    )
    top_peak = max((c.enrolled for c in top), default=0) or 1

    context.update({
        "kpis": kpis,
        "signups": signups,
        "signups_total": sum(per_day.values()),
        "pending_courses": [
            {"title": c.title, "teacher": c.teacher.name, "category": c.category.title,
             "since": c.updated_at, "url": reverse("admin:courses_course_change", args=[c.pk])}
            for c in pending[:6]
        ],
        "recent_payments": paid.select_related("student", "course").order_by("-paid_at")[:6],
        "top_courses": [
            {"title": c.title, "teacher": c.teacher.name, "enrolled": c.enrolled,
             "width": round(100 * c.enrolled / top_peak),
             "url": reverse("admin:courses_course_change", args=[c.pk])}
            for c in top
        ],
        "courses_url": reverse("admin:courses_course_changelist"),
        "payments_url": reverse("admin:payments_payment_changelist"),
    })
    return context
