"""Admin portal API: platform-wide reports and management. ADMIN role only."""
from datetime import timedelta

from django.db.models import Count, OuterRef, Prefetch, Q, Subquery, Sum
from django.db.models.functions import Coalesce, TruncDate
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import generics, serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.services import email_login_details
from apps.certificates.models import Certificate
from apps.courses import services as course_services
from apps.courses.models import Course, CourseModule, Lesson
from apps.enrollments.models import Enrollment
from apps.payments import services as payment_services
from apps.payments.models import Payment, PaymentSettings
from apps.users.models import User
from apps.users.permissions import IsPlatformAdmin

from .serializers import (
    AdminCourseDetailSerializer,
    AdminCourseSerializer,
    AdminEnrollmentSerializer,
    AdminPaymentSerializer,
    AdminQrSettingsSerializer,
    AdminUserCreateSerializer,
    AdminUserSerializer,
    PaymentRejectSerializer,
    RejectSerializer,
)

ACCESS = Enrollment.ACCESS_STATUSES
DAYS = 30


def _daily(queryset, date_field: str, value=None, start=None) -> dict:
    """{date: count or sum} for rows on/after `start`."""
    rows = (
        queryset.filter(**{f"{date_field}__date__gte": start})
        .annotate(day=TruncDate(date_field))
        .values("day")
        .annotate(v=value or Count("id"))
        .values_list("day", "v")
    )
    return {day: float(v or 0) for day, v in rows}


def _count_subquery(model, **filters):
    return Coalesce(Subquery(
        model.objects.filter(**filters).order_by().values("course").annotate(n=Count("id")).values("n")
    ), 0)


def courses_for_admin():
    return (
        Course.objects.with_stats()
        .annotate(
            enrolled=_count_subquery(Enrollment, course=OuterRef("pk"), status__in=ACCESS),
            completed=_count_subquery(Enrollment, course=OuterRef("pk"), status=Enrollment.Status.COMPLETED),
        )
        .select_related("teacher", "category")
    )


class SummaryView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses=inline_serializer("AdminSummary", {"totals": serializers.DictField()}))
    def get(self, request):
        now = timezone.now()
        start = timezone.localdate() - timedelta(days=DAYS - 1)  # local (Thimphu) days, like TruncDate
        month_ago = now - timedelta(days=DAYS)
        students = User.objects.filter(role=User.Role.STUDENT)
        access = Enrollment.objects.filter(status__in=ACCESS)
        paid = Payment.objects.filter(status=Payment.Status.SUCCEEDED)
        by_status = dict(Course.objects.values_list("status").annotate(n=Count("id")))

        signups = _daily(students, "date_joined", start=start)
        enrollments = _daily(access, "activated_at", start=start)
        revenue = _daily(paid, "paid_at", value=Sum("amount"), start=start)
        days = [start + timedelta(days=i) for i in range(DAYS)]

        top = courses_for_admin().filter(status=Course.Status.PUBLISHED).order_by("-enrolled", "title")[:6]
        completions = access.filter(status=Enrollment.Status.COMPLETED).count()

        return Response({
            "totals": {
                "students": students.count(),
                "students_30d": students.filter(date_joined__gte=month_ago).count(),
                "teachers": User.objects.filter(role=User.Role.TEACHER).count(),
                "admins": User.objects.filter(role=User.Role.ADMIN).count(),
                "courses": {s: by_status.get(s, 0) for s in Course.Status.values},
                "enrollments": access.count(),
                "enrollments_30d": access.filter(activated_at__gte=month_ago).count(),
                "completions": completions,
                "completion_rate": round(100 * completions / access.count()) if access.exists() else 0,
                "certificates": Certificate.objects.count(),
                "revenue": float(paid.aggregate(s=Sum("amount"))["s"] or 0),
                "revenue_30d": float(paid.filter(paid_at__gte=month_ago).aggregate(s=Sum("amount"))["s"] or 0),
                "failed_payments_30d": Payment.objects.filter(
                    status=Payment.Status.FAILED, created_at__gte=month_ago
                ).count(),
            },
            "series": [
                {"date": d.isoformat(), "signups": int(signups.get(d, 0)),
                 "enrollments": int(enrollments.get(d, 0)), "revenue": revenue.get(d, 0)}
                for d in days
            ],
            "top_courses": [
                {"id": c.slug, "title": c.title, "teacher": c.teacher.name, "enrolled": c.enrolled,
                 "completion_rate": round(100 * c.completed / c.enrolled) if c.enrolled else 0}
                for c in top
            ],
            "pending_review": AdminCourseSerializer(
                courses_for_admin().filter(status=Course.Status.PENDING_REVIEW).order_by("updated_at")[:5], many=True
            ).data,
            "recent_payments": AdminPaymentSerializer(
                paid.select_related("student", "course").order_by("-paid_at")[:6], many=True
            ).data,
        })


class AdminCourseListView(generics.ListAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = AdminCourseSerializer
    queryset = Course.objects.none()

    @extend_schema(parameters=[OpenApiParameter("status", str), OpenApiParameter("search", str)])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        qs = courses_for_admin().order_by("-updated_at")
        params = self.request.query_params
        if params.get("status") in Course.Status.values:
            qs = qs.filter(status=params["status"])
        if search := params.get("search", "").strip():
            qs = qs.filter(Q(title__icontains=search) | Q(teacher__name__icontains=search))
        return qs


def course_detail(slug):
    lessons = Prefetch("lessons", queryset=Lesson.objects.prefetch_related("resources"))
    modules = Prefetch("modules", queryset=CourseModule.objects.prefetch_related(lessons))
    course = get_object_or_404(courses_for_admin().prefetch_related(modules), slug=slug)
    course.review_problems = course_services.review_problems(course)
    return course


class AdminCourseDetailView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses=AdminCourseDetailSerializer)
    def get(self, request, slug):
        return Response(AdminCourseDetailSerializer(course_detail(slug)).data)


class ApproveCourseView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses=AdminCourseDetailSerializer)
    def post(self, request, slug):
        course_services.approve(get_object_or_404(Course, slug=slug))
        return Response(AdminCourseDetailSerializer(course_detail(slug)).data)


class RejectCourseView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=RejectSerializer, responses=AdminCourseDetailSerializer)
    def post(self, request, slug):
        serializer = RejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        course_services.reject(get_object_or_404(Course, slug=slug), serializer.validated_data["note"])
        return Response(AdminCourseDetailSerializer(course_detail(slug)).data)


def users_for_admin():
    enrolled = (
        Enrollment.objects.filter(student=OuterRef("pk"), status__in=ACCESS)
        .order_by().values("student").annotate(n=Count("id")).values("n")
    )
    taught = Course.objects.filter(teacher=OuterRef("pk")).order_by().values("teacher").annotate(n=Count("id")).values("n")
    # Site administrators live only in Django Admin; the portal can't list, edit or reset them.
    return User.objects.exclude(role=User.Role.SITE_ADMIN).filter(is_staff=False, is_superuser=False).annotate(
        enrollment_count=Coalesce(Subquery(enrolled), 0), course_count=Coalesce(Subquery(taught), 0)
    )


class AdminUserListView(generics.ListCreateAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = AdminUserSerializer
    queryset = User.objects.none()

    @extend_schema(parameters=[OpenApiParameter("role", str), OpenApiParameter("search", str), OpenApiParameter("active", bool)])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        qs = users_for_admin().order_by("-date_joined")
        params = self.request.query_params
        if params.get("role") in User.Role.values:
            qs = qs.filter(role=params["role"])
        if params.get("active") in ("true", "false"):
            qs = qs.filter(is_active=params["active"] == "true")
        if search := params.get("search", "").strip():
            qs = qs.filter(Q(name__icontains=search) | Q(email__icontains=search))
        return qs

    @extend_schema(request=AdminUserCreateSerializer, responses={201: AdminUserSerializer})
    def post(self, request, *args, **kwargs):
        serializer = AdminUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        sent = email_login_details(user)
        data = AdminUserSerializer(users_for_admin().get(pk=user.pk), context={"request": request}).data
        data["email_sent"] = sent
        return Response(data, status=status.HTTP_201_CREATED)


class AdminUserDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = AdminUserSerializer
    http_method_names = ["get", "patch"]
    queryset = User.objects.none()

    def get_queryset(self):
        return users_for_admin()


class AdminResetPasswordView(APIView):
    """Email the user a new temporary password and sign them out everywhere. Admins never see it."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses=AdminUserSerializer)
    def post(self, request, pk):
        user = get_object_or_404(users_for_admin(), pk=pk)
        if user.pk == request.user.pk:
            return Response({"detail": "Change your own password from your account page."},
                            status=status.HTTP_400_BAD_REQUEST)
        sent = email_login_details(user, reset=True)
        data = AdminUserSerializer(users_for_admin().get(pk=user.pk), context={"request": request}).data
        data["email_sent"] = sent
        return Response(data)


class AdminEnrollmentListView(generics.ListAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = AdminEnrollmentSerializer
    queryset = Enrollment.objects.none()

    @extend_schema(parameters=[OpenApiParameter("status", str), OpenApiParameter("search", str), OpenApiParameter("course", str)])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        params = self.request.query_params
        qs = (
            Enrollment.objects.annotate(
                completed_lessons=Count("lesson_progress", filter=Q(lesson_progress__completed=True), distinct=True),
                total_lessons=Count("course__modules__lessons", distinct=True),
            )
            .select_related("student", "course")
            .order_by("-created_at")
        )
        if params.get("status") in Enrollment.Status.values:
            qs = qs.filter(status=params["status"])
        if course := params.get("course"):
            qs = qs.filter(course__slug=course)
        if search := params.get("search", "").strip():
            qs = qs.filter(Q(student__name__icontains=search) | Q(student__email__icontains=search)
                           | Q(course__title__icontains=search))
        return qs


class AdminPaymentListView(generics.ListAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = AdminPaymentSerializer
    queryset = Payment.objects.none()

    @extend_schema(parameters=[OpenApiParameter("status", str), OpenApiParameter("search", str)])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        params = self.request.query_params
        qs = Payment.objects.select_related("student", "course").order_by("-created_at")
        if params.get("status") in Payment.Status.values:
            qs = qs.filter(status=params["status"])
        if search := params.get("search", "").strip():
            compact = search.replace(" ", "")
            qs = qs.filter(Q(reference__icontains=search) | Q(journal_number__icontains=compact)
                           | Q(contact_number__icontains=compact)
                           | Q(student__name__icontains=search)
                           | Q(student__email__icontains=search) | Q(course__title__icontains=search))
        return qs


def _qr_payment(reference) -> Payment:
    return get_object_or_404(Payment.objects.select_related("student", "course", "reviewed_by"), reference=reference)


class ApprovePaymentView(APIView):
    """The money is in the bank statement: unlock the course for the student."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses=AdminPaymentSerializer)
    def post(self, request, reference):
        payment = payment_services.approve_qr_payment(_qr_payment(reference), request.user)
        return Response(AdminPaymentSerializer(_qr_payment(payment.reference)).data)


class RejectPaymentView(APIView):
    """The payment couldn't be found or doesn't match: tell the student why (they can resubmit)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=PaymentRejectSerializer, responses=AdminPaymentSerializer)
    def post(self, request, reference):
        serializer = PaymentRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = payment_services.reject_qr_payment(_qr_payment(reference), request.user, serializer.validated_data["reason"])
        return Response(AdminPaymentSerializer(_qr_payment(payment.reference)).data)


class PaymentProofView(APIView):
    """The student's payment screenshot. Only admins can open it (it's never a public file link)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={(200, "image/*"): bytes})
    def get(self, request, reference):
        payment = _qr_payment(reference)
        if not payment.proof:
            raise Http404
        response = FileResponse(payment.proof.open("rb"))
        response["Cache-Control"] = "private, no-store"
        return response


class QrSettingsAdminView(APIView):
    """Lop-rig's bank QR code and account details that students pay to."""

    permission_classes = [IsPlatformAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(responses=AdminQrSettingsSerializer)
    def get(self, request):
        return Response(AdminQrSettingsSerializer(PaymentSettings.load(), context={"request": request}).data)

    @extend_schema(request={"multipart/form-data": AdminQrSettingsSerializer}, responses=AdminQrSettingsSerializer)
    def patch(self, request):
        serializer = AdminQrSettingsSerializer(PaymentSettings.load(), data=request.data, partial=True,
                                               context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
