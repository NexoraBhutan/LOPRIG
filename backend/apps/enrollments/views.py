from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.courses.models import Course
from apps.users.permissions import IsStudent

from . import services
from .models import Enrollment, SavedCourse
from .serializers import (
    CourseSlugSerializer,
    EnrollmentSerializer,
    EnrollmentStatusSerializer,
    SavedCourseSerializer,
)


def courses_with_stats():
    return Course.objects.with_stats().select_related("category", "teacher")


def enrollments_with_progress(student):
    return (
        Enrollment.objects.filter(student=student)
        .annotate(
            completed_lessons=Count("lesson_progress", filter=Q(lesson_progress__completed=True), distinct=True),
            total_lessons=Count("course__modules__lessons", distinct=True),
        )
        .prefetch_related(Prefetch("course", queryset=courses_with_stats()))
        .order_by("-updated_at")  # Meta.ordering is dropped for aggregated querysets
    )


class EnrollView(APIView):
    """Enroll in a free course. Paid courses answer 402 and must go through /payments/checkout/."""

    permission_classes = [IsStudent]

    @extend_schema(request=None, responses={200: EnrollmentStatusSerializer, 201: EnrollmentStatusSerializer})
    def post(self, request, slug):
        course = get_object_or_404(Course.objects.published(), slug=slug)
        enrollment, created = services.enroll_free(request.user, course)
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(EnrollmentStatusSerializer(enrollment).data, status=code)


class EnrollmentListView(generics.ListAPIView):
    """'My courses': enrollments the student can learn from (active + completed) with progress."""

    queryset = Enrollment.objects.none()  # schema hint; get_queryset() scopes to the user
    permission_classes = [IsStudent]
    serializer_class = EnrollmentSerializer

    @extend_schema(parameters=[OpenApiParameter("status", str, enum=["ACTIVE", "COMPLETED"])])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        qs = enrollments_with_progress(self.request.user).filter(status__in=Enrollment.ACCESS_STATUSES)
        wanted = self.request.query_params.get("status")
        if wanted in Enrollment.ACCESS_STATUSES:
            qs = qs.filter(status=wanted)
        return qs


class EnrollmentDetailView(generics.RetrieveAPIView):
    """Enrollment for one course (by course slug). 404 means not enrolled."""

    permission_classes = [IsStudent]
    serializer_class = EnrollmentSerializer

    def get_object(self):
        return get_object_or_404(enrollments_with_progress(self.request.user), course__slug=self.kwargs["slug"])


class SavedCourseListView(generics.ListCreateAPIView):
    queryset = SavedCourse.objects.none()  # schema hint; get_queryset() scopes to the user
    permission_classes = [IsStudent]
    serializer_class = SavedCourseSerializer

    def get_queryset(self):
        return SavedCourse.objects.filter(student=self.request.user).prefetch_related(
            Prefetch("course", queryset=courses_with_stats())
        )

    @extend_schema(request=CourseSlugSerializer, responses={201: SavedCourseSerializer})
    def post(self, request, *args, **kwargs):
        serializer = CourseSlugSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        saved, created = SavedCourse.objects.get_or_create(
            student=request.user, course=serializer.validated_data["course"]
        )
        saved = self.get_queryset().get(pk=saved.pk)
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(SavedCourseSerializer(saved).data, status=code)


class SavedCourseDeleteView(APIView):
    permission_classes = [IsStudent]

    @extend_schema(responses={204: None})
    def delete(self, request, slug):
        SavedCourse.objects.filter(student=request.user, course__slug=slug).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
