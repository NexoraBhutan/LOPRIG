"""Teacher portal API. Every queryset is scoped to request.user's own courses,
so another teacher's course simply does not exist (404) from here."""
from django.db.models import Count, Max, OuterRef, Prefetch, Q, Subquery, Sum
from django.db.models.functions import Coalesce
from django.db import transaction
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, serializers, status
from rest_framework.exceptions import APIException
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.courses import services as course_services
from apps.courses import video
from apps.courses.models import Course, CourseModule, Lesson, LessonResource, Quiz, QuizQuestion
from apps.enrollments.models import Enrollment
from apps.learning.models import QuizAttempt
from apps.payments.models import Payment
from apps.users.permissions import IsTeacher

from .serializers import (
    CourseCoverSerializer,
    StudentProgressSerializer,
    TeacherCourseDetailSerializer,
    TeacherCourseSerializer,
    TeacherLessonSerializer,
    TeacherModuleSerializer,
    QuizInputSerializer,
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


def lessons_with_stats():
    """Lessons with how many students opened them and how many finished them."""
    from apps.learning.models import LessonProgress

    finished = (
        LessonProgress.objects.filter(lesson=OuterRef("pk"), completed=True)
        .order_by().values("lesson").annotate(n=Count("id")).values("n")
    )
    return Lesson.objects.prefetch_related("resources").annotate(
        n_viewers=Count("views", distinct=True), n_completed=Coalesce(Subquery(finished), 0),
    )


def course_with_curriculum(user, slug):
    lessons = Prefetch("lessons", queryset=lessons_with_stats())
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
        "pending_reviews": serializers.IntegerField(),
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
            "pending_reviews": QuizAttempt.objects.filter(
                quiz__module__course__teacher=request.user, status=QuizAttempt.Status.PENDING).count(),
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


class CourseCoverView(APIView):
    """POST: upload the course card image (replaces the old one). DELETE: back to the colour gradient."""

    permission_classes = [IsTeacher]
    parser_classes = [MultiPartParser, FormParser]

    def _save(self, request, course, image):
        old = course.cover_image.name if course.cover_image else None
        course.cover_image = image
        course.save(update_fields=["cover_image", "updated_at"])
        if old:
            course.cover_image.storage.delete(old)
        detail = course_with_curriculum(request.user, course.slug)
        return Response(TeacherCourseDetailSerializer(detail, context={"request": request}).data)

    @extend_schema(request={"multipart/form-data": CourseCoverSerializer}, responses=TeacherCourseDetailSerializer)
    def post(self, request, slug):
        course = get_object_or_404(Course, teacher=request.user, slug=slug)
        serializer = CourseCoverSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._save(request, course, serializer.validated_data["image"])

    @extend_schema(responses=TeacherCourseDetailSerializer)
    def delete(self, request, slug):
        course = get_object_or_404(Course, teacher=request.user, slug=slug)
        return self._save(request, course, None)


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


def _quiz_data(module: CourseModule) -> dict:
    """The chapter's quiz with answers (for its teacher), or an empty draft when there is none."""
    quiz = Quiz.objects.filter(module=module).prefetch_related("questions").first()
    if quiz is None:
        return {"id": None, "title": f"{module.title} quiz"[:200], "pass_percent": 70, "questions": []}
    return {
        "id": quiz.id, "title": quiz.title, "pass_percent": quiz.pass_percent,
        "questions": [{"kind": q.kind, "prompt": q.prompt, "options": q.options, "correct": q.correct,
                       "model_answer": q.model_answer, "explanation": q.explanation}
                      for q in quiz.questions.all()],
    }


class ModuleQuizView(APIView):
    """GET: the chapter quiz with answers. PUT: save the whole quiz. DELETE: remove it."""

    permission_classes = [IsTeacher]

    def _module(self, request, pk) -> CourseModule:
        return get_object_or_404(CourseModule, pk=pk, course__teacher=request.user)

    def get(self, request, pk):
        return Response(_quiz_data(self._module(request, pk)))

    @extend_schema(request=QuizInputSerializer)
    def put(self, request, pk):
        module = self._module(request, pk)
        data = QuizInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        with transaction.atomic():
            quiz, _ = Quiz.objects.update_or_create(
                module=module, defaults={"title": v["title"], "pass_percent": v["pass_percent"]},
            )
            quiz.questions.all().delete()
            QuizQuestion.objects.bulk_create([
                QuizQuestion(quiz=quiz, order=i, kind=q["kind"], prompt=q["prompt"], options=q["options"],
                             correct=q["correct"], model_answer=q.get("model_answer", ""),
                             explanation=q.get("explanation", ""))
                for i, q in enumerate(v["questions"])
            ])
        return Response(_quiz_data(module))

    @extend_schema(responses={204: None})
    def delete(self, request, pk):
        Quiz.objects.filter(module=self._module(request, pk)).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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


class VideoUnavailable(APIException):
    status_code = 503
    default_code = "video_unavailable"


def _my_lesson(user, pk) -> Lesson:
    return get_object_or_404(Lesson.objects.select_related("module__course"), pk=pk, module__course__teacher=user)


def _lesson_response(lesson: Lesson, **extra) -> Response:
    lesson = Lesson.objects.prefetch_related("resources").get(pk=lesson.pk)
    return Response({**TeacherLessonSerializer(lesson).data, **extra})


class LessonVideoUploadView(APIView):
    """Start an upload: create the video on Bunny and return a signed, time-limited upload ticket.

    The browser then uploads the file straight to Bunny (TUS, resumable). Uploading again replaces
    the previous video.
    """

    permission_classes = [IsTeacher]

    @extend_schema(request=None, responses=inline_serializer("VideoUploadTicket", {
        "lesson": TeacherLessonSerializer(), "upload": serializers.DictField(),
    }))
    def post(self, request, pk):
        lesson = _my_lesson(request.user, pk)
        if not video.is_configured():
            raise VideoUnavailable("Video uploads aren't set up yet. Paste a YouTube or Vimeo link for now.")
        try:
            video_id = video.create_video(f"{lesson.course.title} · {lesson.title}")
        except video.VideoServiceError as exc:
            raise VideoUnavailable(str(exc)) from exc
        old = lesson.video_id
        lesson.video_id, lesson.video_status = video_id, Lesson.VideoStatus.UPLOADING
        lesson.video_url, lesson.kind = "", Lesson.Kind.VIDEO
        lesson.save(update_fields=["video_id", "video_status", "video_url", "kind"])
        video.delete_video(old)
        lesson_data = _lesson_response(lesson).data
        return Response({"lesson": lesson_data, "upload": video.upload_ticket(video_id)})


class LessonVideoView(APIView):
    """POST: re-check the upload's status with Bunny (the page polls this). DELETE: remove the upload."""

    permission_classes = [IsTeacher]

    @extend_schema(request=None, responses=TeacherLessonSerializer)
    def post(self, request, pk):
        lesson = _my_lesson(request.user, pk)
        if lesson.video_id:
            try:
                lesson.refresh_video_status()
            except video.VideoServiceError as exc:
                raise VideoUnavailable(str(exc)) from exc
        return _lesson_response(lesson)

    @extend_schema(responses=TeacherLessonSerializer)
    def delete(self, request, pk):
        lesson = _my_lesson(request.user, pk)
        old = lesson.video_id
        lesson.video_id, lesson.video_status = "", Lesson.VideoStatus.NONE
        lesson.save(update_fields=["video_id", "video_status"])
        video.delete_video(old)
        return _lesson_response(lesson)


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
