from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Prefetch
from django.utils import timezone
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import APIException, NotAuthenticated, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.certificates.models import Certificate
from apps.courses import video
from apps.courses.models import Course, CourseModule, Lesson
from apps.courses.serializers import CourseListSerializer
from apps.users.permissions import IsStudent

from . import services
from .models import LessonProgress
from .serializers import (
    LearnCourseSerializer,
    LearningSummarySerializer,
    LessonContentSerializer,
    ModuleContentSerializer,
    ProgressUpdateResponseSerializer,
    ProgressUpdateSerializer,
)


def progress_map(enrollment) -> dict:
    if enrollment is None:
        return {}
    return {p.lesson_id: p for p in LessonProgress.objects.filter(enrollment=enrollment)}


class LearnCourseView(APIView):
    """The course player: every module and lesson with content and the student's progress.

    Free published courses are open to everyone (visitors get the lessons without progress);
    paid courses need an active enrollment.
    """

    permission_classes = [AllowAny]

    @extend_schema(responses=LearnCourseSerializer)
    def get(self, request, slug):
        # Not limited to published: students keep access to courses they enrolled in.
        course = get_object_or_404(Course.objects.with_stats().select_related("category", "teacher"), slug=slug)
        user = request.user
        is_student = user.is_authenticated and user.is_student and not user.must_change_password
        if is_student:
            enrollment = services.require_access(user, course)
        elif services.is_open_course(course):
            enrollment = None  # a visitor (or staff) watching a free course
        elif not user.is_authenticated:
            raise NotAuthenticated()
        else:
            raise PermissionDenied("Only student accounts can open paid courses.")

        lessons = Prefetch("lessons", queryset=Lesson.objects.prefetch_related("resources")
                           .annotate(views_count=Count("views", distinct=True)))
        modules = (
            CourseModule.objects.filter(course=course).select_related("quiz").prefetch_related(lessons)
            .annotate(quiz_questions=Count("quiz__questions", distinct=True))
        )
        context = {"request": request, "progress": progress_map(enrollment),
                   "quiz_results": services.quiz_results(enrollment)}
        total = sum(len(m.lessons.all()) for m in modules)
        if enrollment is None:
            quizzes = sum(1 for m in modules if m.quiz_questions)
            return Response({
                "course": CourseListSerializer(course, context=context).data,
                "status": "OPEN",
                "progress": {"completed_lessons": 0, "total_lessons": total, "passed_quizzes": 0,
                             "total_quizzes": quizzes, "percent": 0},
                "last_lesson": None,
                "certificate": None,
                "modules": ModuleContentSerializer(modules, many=True, context=context).data,
            })
        certificate = Certificate.objects.filter(enrollment=enrollment).values_list("code", flat=True).first()
        return Response({
            "course": CourseListSerializer(course, context=context).data,
            "status": enrollment.status,
            "progress": services.course_progress(enrollment).as_dict(),
            "last_lesson": enrollment.last_lesson_id,
            "certificate": certificate,
            "modules": ModuleContentSerializer(modules, many=True, context=context).data,
        })


class LessonDetailView(APIView):
    """One lesson with content. Preview lessons are public; others need an active enrollment."""

    permission_classes = [AllowAny]

    @extend_schema(responses=LessonContentSerializer)
    def get(self, request, pk):
        lesson = get_object_or_404(
            Lesson.objects.select_related("module__course").prefetch_related("resources"), pk=pk
        )
        enrollment = services.check_lesson_access(request.user, lesson)
        context = {"request": request, "progress": progress_map(enrollment)}
        return Response(LessonContentSerializer(lesson, context=context).data)


class LessonProgressView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(request=ProgressUpdateSerializer, responses=ProgressUpdateResponseSerializer)
    def post(self, request, pk):
        lesson = get_object_or_404(Lesson.objects.select_related("module__course"), pk=pk)
        serializer = ProgressUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        progress, course_progress, certificate = services.record_progress(
            request.user,
            lesson,
            position_seconds=serializer.validated_data.get("position_seconds"),
            completed=serializer.validated_data["completed"],
        )
        return Response({
            "lesson": lesson.id,
            "completed": progress.completed,
            "position_seconds": progress.position_seconds,
            "course_progress": course_progress.as_dict(),
            "course_completed": course_progress.percent == 100,
            "certificate": certificate.code if certificate else None,
        })


class LearningSummaryView(APIView):
    """Dashboard numbers: streak, XP, course and lesson counts."""

    permission_classes = [IsStudent]

    @extend_schema(responses=LearningSummarySerializer)
    def get(self, request):
        return Response(services.learning_summary(request.user))


class OfflineUnavailable(APIException):
    status_code = 503
    default_detail = "Offline downloads aren't available right now."
    default_code = "offline_unavailable"


class LessonDownloadView(APIView):
    """A short-lived link to save one lesson's video inside Lop-rig for offline viewing.

    Only students with access to the course. The browser encrypts the file and keeps it for
    OFFLINE_DOWNLOAD_DAYS; it plays only in Lop-rig's own player.
    """

    permission_classes = [IsStudent]

    @extend_schema(request=None, responses=dict)
    def post(self, request, pk):
        lesson = get_object_or_404(Lesson.objects.select_related("module__course"), pk=pk)
        services.require_access(request.user, lesson.module.course)
        if not lesson.video_id or lesson.video_status != Lesson.VideoStatus.READY:
            raise ValidationError({"detail": "Only uploaded lesson videos can be saved for offline."})
        try:
            url, resolution = video.offline_file_url(lesson.video_id)
        except video.VideoServiceError as exc:
            raise OfflineUnavailable(str(exc)) from exc
        return Response({
            "url": url,
            "resolution": resolution,
            "lesson": lesson.pk,
            "title": lesson.title,
            "course": lesson.module.course.slug,
            "keep_until": timezone.now() + timedelta(days=settings.OFFLINE_DOWNLOAD_DAYS),
        })
