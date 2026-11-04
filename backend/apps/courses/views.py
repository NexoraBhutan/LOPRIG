import json
import logging

from django.conf import settings
from django.db.models import Count, Prefetch, Q
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import video

from .filters import CourseFilter
from .models import Category, Course, CourseModule, Lesson
from .serializers import CategorySerializer, CourseDetailSerializer, CourseListSerializer


def categories_with_counts():
    return Category.objects.annotate(
        course_count=Count("courses", filter=Q(courses__status=Course.Status.PUBLISHED))
    )


class CategoryListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = CategorySerializer
    pagination_class = None

    def get_queryset(self):
        return categories_with_counts()


class CategoryDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = CategorySerializer
    lookup_field = "slug"

    def get_queryset(self):
        return categories_with_counts()


class CourseListView(generics.ListAPIView):
    """Published catalogue. Filters: category, level, price, min_rating, search, sort."""

    permission_classes = [AllowAny]
    serializer_class = CourseListSerializer
    filterset_class = CourseFilter

    def get_queryset(self):
        return (
            Course.objects.published()
            .with_stats()
            .select_related("category", "teacher")
            .order_by("-students_count", "-rating")
        )


class CourseDetailView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = CourseDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        lessons = Prefetch("lessons", queryset=Lesson.objects.order_by("order", "id"))
        modules = Prefetch("modules", queryset=CourseModule.objects.prefetch_related(lessons))
        return (
            Course.objects.published()
            .with_stats()
            .select_related("category", "teacher")
            .prefetch_related(modules)
        )


logger = logging.getLogger(__name__)


class BunnyStreamWebhookView(APIView):
    """Bunny calls this when a video's processing state changes (set the URL in the Stream library).

    The payload is only a hint: the status we store always comes from asking Bunny directly.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(request=None, responses={200: None})
    def post(self, request):
        if not video.valid_webhook_signature(request.body, request.headers):
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        try:
            video_id = str(json.loads(request.body).get("VideoGuid") or "")
        except (ValueError, AttributeError):
            return Response(status=status.HTTP_400_BAD_REQUEST)
        for lesson in Lesson.objects.filter(video_id=video_id) if video_id else []:
            try:
                lesson.refresh_video_status()
            except video.VideoServiceError:
                logger.warning("Webhook for video %s: couldn't refresh its status", video_id)
        return Response(status=status.HTTP_200_OK)


class SiteConfigView(APIView):
    """Public switches the frontend needs (no secrets)."""

    permission_classes = [AllowAny]

    @extend_schema(responses=inline_serializer("SiteConfig", {"payments_enabled": serializers.BooleanField()}))
    def get(self, request):
        return Response({"payments_enabled": settings.PAYMENTS_ENABLED})
