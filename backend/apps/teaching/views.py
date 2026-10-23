"""Teacher portal API. Every queryset is scoped to request.user's own courses,
so another teacher's course simply does not exist (404) from here."""
from django.db.models import Count, Max, OuterRef, Prefetch, Q, Subquery, Sum
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, serializers, status
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.courses import services as course_services
from apps.courses.models import Course, CourseModule, Lesson, LessonResource
from apps.enrollments.models import Enrollment
from apps.payments.models import Payment
from apps.users.permissions import IsTeacher

from .serializers import (
    StudentProgressSerializer,
    TeacherCourseDetailSerializer,
    TeacherCourseSerializer,
    TeacherLessonSerializer,
    TeacherModuleSerializer,
    TeacherResourceSerializer,
)


class Conflict(APIException):
    status_code = 409
    default_code = "conflict"


def my_courses(user):
    enrolled = (
        Enrollment.objects.filter(course=OuterRef("pk"), status__in=Enrollment.ACCESS_STATUSES)
        .order_by()
        .values("course")
        .annotate(n=Count("id"))
        .values("n")
    )
    return (
        Course.objects.filter(teacher=user)
        .with_stats()
        .annotate(enrolled=Coalesce(Subquery(enrolled), 0))
        .select_related("category")
    )


def course_with_curriculum(user, slug):
    lessons = Prefetch("lessons", queryset=Lesson.objects.prefetch_related("resources"))
    modules = Prefetch("modules", queryset=CourseModule.objects.prefetch_related(lessons))
    return get_object_or_404(my_courses(user).prefetch_related(modules), slug=slug)


def next_order(queryset) -> int:
    current = queryset.aggregate(m=Max("order"))["m"]
    return 0 if current is None else current + 1


class TeacherSummaryView(APIView):
    permission_classes = [IsTeacher]

    @extend_schema(responses=inline_serializer("TeacherSummary", {
        "courses": serializers.DictField(child=serializers.IntegerField()),
        "students": serializers.IntegerField(),
        "completions": serializers.IntegerField(),
        "revenue": serializers.FloatField(),
        "recent_enrollments": serializers.ListField(child=serializers.DictField()),
    }))
    def get(self, request):
        courses = Course.objects.filter(teacher=request.user)
        by_status = dict(courses.values_list("status").annotate(n=Count("id")))
        access = Enrollment.objects.filter(course__teacher=request.user, status__in=Enrollment.ACCESS_STATUSES)
        revenue = Payment.objects.filter(course__teacher=request.user, status=Payment.Status.SUCCEEDED).aggregate(
            s=Sum("amount")
        )["s"]
        recent = access.select_related("student", "course").order_by("-activated_at")[:8]
        return Response({
            "courses": {s: by_status.get(s, 0) for s in Course.Status.values} | {"total": courses.count()},
            "students": access.values("student").distinct().count(),
            "completions": access.filter(status=Enrollment.Status.COMPLETED).count(),
            "revenue": float(revenue or 0),
            "recent_enrollments": [
                {"student": e.student.name, "course": e.course.title, "course_id": e.course.slug,
                 "enrolled_at": e.activated_at}
                for e in recent
            ],
        })


class TeacherCourseListView(generics.ListCreateAPIView):
    permission_classes = [IsTeacher]
    serializer_class = TeacherCourseSerializer
    pagination_class = None
    queryset = Course.objects.none()  # schema hint; get_queryset() scopes to the teacher

    def get_queryset(self):
        return my_courses(self.request.user).order_by("-updated_at")

    def perform_create(self, serializer):
        serializer.save(teacher=self.request.user, status=Course.Status.DRAFT)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        course = course_with_curriculum(request.user, serializer.instance.slug)
        return Response(TeacherCourseDetailSerializer(course).data, status=status.HTTP_201_CREATED)


class TeacherCourseDetailView(APIView):
    permission_classes = [IsTeacher]

    @extend_schema(responses=TeacherCourseDetailSerializer)
    def get(self, request, slug):
        return Response(TeacherCourseDetailSerializer(course_with_curriculum(request.user, slug)).data)

    @extend_schema(request=TeacherCourseSerializer, responses=TeacherCourseDetailSerializer)
    def patch(self, request, slug):
        course = get_object_or_404(Course, teacher=request.user, slug=slug)
        serializer = TeacherCourseSerializer(course, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(TeacherCourseDetailSerializer(course_with_curriculum(request.user, slug)).data)

    @extend_schema(responses={204: None})
    def delete(self, request, slug):
        course = get_object_or_404(Course, teacher=request.user, slug=slug)
        if course.status not in course_services.SUBMITTABLE or course.enrollments.exists():
            raise Conflict("Only unpublished courses without students can be deleted.")
        course.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SubmitForReviewView(APIView):
    permission_classes = [IsTeacher]

    @extend_schema(request=None, responses=TeacherCourseDetailSerializer)
    def post(self, request, slug):
        course = get_object_or_404(Course, teacher=request.user, slug=slug)
        course_services.submit_for_review(course)
        return Response(TeacherCourseDetailSerializer(course_with_curriculum(request.user, slug)).data)


class ModuleCreateView(APIView):
    permission_classes = [IsTeacher]

    @extend_schema(request=TeacherModuleSerializer, responses={201: TeacherModuleSerializer})
    def post(self, request, slug):
        course = get_object_or_404(Course, teacher=request.user, slug=slug)
        serializer = TeacherModuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.validated_data.pop("order", None)
        module = serializer.save(course=course, order=next_order(course.modules) if order is None else order)
        return Response(TeacherModuleSerializer(module).data, status=status.HTTP_201_CREATED)


class ModuleDetailView(generics.UpdateAPIView, generics.DestroyAPIView):
    permission_classes = [IsTeacher]
    serializer_class = TeacherModuleSerializer
    http_method_names = ["patch", "delete"]
    queryset = CourseModule.objects.none()

    def get_queryset(self):
        return CourseModule.objects.filter(course__teacher=self.request.user).prefetch_related("lessons__resources")


class LessonCreateView(APIView):
    permission_classes = [IsTeacher]

    @extend_schema(request=TeacherLessonSerializer, responses={201: TeacherLessonSerializer})
    def post(self, request, pk):
        module = get_object_or_404(CourseModule, pk=pk, course__teacher=request.user)
        serializer = TeacherLessonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.validated_data.pop("order", None)
        lesson = serializer.save(module=module, order=next_order(module.lessons) if order is None else order)
        return Response(TeacherLessonSerializer(lesson).data, status=status.HTTP_201_CREATED)


class LessonDetailView(generics.UpdateAPIView, generics.DestroyAPIView):
    permission_classes = [IsTeacher]
    serializer_class = TeacherLessonSerializer
    http_method_names = ["patch", "delete"]
    queryset = Lesson.objects.none()

    def get_queryset(self):
        return Lesson.objects.filter(module__course__teacher=self.request.user).prefetch_related("resources")


class ResourceCreateView(APIView):
    permission_classes = [IsTeacher]

    @extend_schema(request=TeacherResourceSerializer, responses={201: TeacherResourceSerializer})
    def post(self, request, pk):
        lesson = get_object_or_404(Lesson, pk=pk, module__course__teacher=request.user)
        serializer = TeacherResourceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(lesson=lesson)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ResourceDeleteView(generics.DestroyAPIView):
    permission_classes = [IsTeacher]
    serializer_class = TeacherResourceSerializer
    queryset = LessonResource.objects.none()

    def get_queryset(self):
        return LessonResource.objects.filter(lesson__module__course__teacher=self.request.user)


class CourseStudentsView(generics.ListAPIView):
    """Students in one of the teacher's courses, with progress."""

    permission_classes = [IsTeacher]
    serializer_class = StudentProgressSerializer
    queryset = Enrollment.objects.none()

    def get_queryset(self):
        self.course = get_object_or_404(Course, teacher=self.request.user, slug=self.kwargs["slug"])
        return (
            Enrollment.objects.filter(course=self.course, status__in=Enrollment.ACCESS_STATUSES)
            .annotate(completed_lessons=Count("lesson_progress", filter=Q(lesson_progress__completed=True)))
            .select_related("student")
            .order_by("-updated_at")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        course = getattr(self, "course", None)
        context["total_lessons"] = Lesson.objects.filter(module__course=course).count() if course else 0
        return context
