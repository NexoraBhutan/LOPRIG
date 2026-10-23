from django.db.models import Count, Prefetch, Q
from rest_framework import generics
from rest_framework.permissions import AllowAny

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
