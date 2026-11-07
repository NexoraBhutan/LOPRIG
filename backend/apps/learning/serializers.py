from rest_framework import serializers

from drf_spectacular.utils import extend_schema_field

from apps.courses import video
from apps.courses.models import CourseModule, Lesson, LessonResource
from apps.courses.serializers import CourseListSerializer, format_clock
from apps.teaching.serializers import PlaybackSerializer


class LessonResourceSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = LessonResource
        fields = ["id", "title", "url"]

    def get_url(self, obj) -> str:
        if obj.file:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
        return obj.url


class LessonContentSerializer(serializers.ModelSerializer):
    """Full lesson, including content. Only serialized after an access check.

    context["progress"] maps lesson id -> LessonProgress for the current student.
    """

    duration = serializers.SerializerMethodField()
    resources = LessonResourceSerializer(many=True, read_only=True)
    completed = serializers.SerializerMethodField()
    position_seconds = serializers.SerializerMethodField()
    video = serializers.SerializerMethodField()
    views = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            "id", "title", "kind", "duration", "duration_seconds", "is_preview",
            "video", "body", "h5p_embed_url", "resources", "completed", "position_seconds", "views",
        ]

    def get_views(self, obj) -> int:
        """Unique students who opened it. Annotated by the course player; counted for one lesson."""
        count = getattr(obj, "views_count", None)
        return count if count is not None else obj.views.count()

    @extend_schema_field(PlaybackSerializer)
    def get_video(self, obj) -> dict:
        """A fresh, short-lived link each time the lesson is opened. Never the raw upload ID."""
        return video.playback(obj)

    def _progress(self, obj):
        return self.context.get("progress", {}).get(obj.id)

    def get_duration(self, obj) -> str:
        return format_clock(obj.duration_seconds)

    def get_completed(self, obj) -> bool:
        progress = self._progress(obj)
        return bool(progress and progress.completed)

    def get_position_seconds(self, obj) -> int:
        progress = self._progress(obj)
        return progress.position_seconds if progress else 0


class ModuleContentSerializer(serializers.ModelSerializer):
    """context["quiz_results"] maps quiz id -> the student's best result (see services.quiz_results)."""

    lessons = LessonContentSerializer(many=True, read_only=True)
    quiz = serializers.SerializerMethodField()

    class Meta:
        model = CourseModule
        fields = ["id", "title", "lessons", "quiz"]

    def get_quiz(self, obj) -> dict | None:
        quiz = getattr(obj, "quiz", None)  # select_related; None when the chapter has no quiz
        count = getattr(obj, "quiz_questions", None)
        if count is None and quiz:
            count = quiz.questions.count()
        if not quiz or not count:
            return None
        result = self.context.get("quiz_results", {}).get(quiz.id, {})
        return {
            "id": quiz.id,
            "title": quiz.title,
            "pass_percent": quiz.pass_percent,
            "questions_count": count,
            "best_score": result.get("best_score"),
            "passed": result.get("passed", False),
            "pending": result.get("pending", False),
        }


class ProgressSerializer(serializers.Serializer):
    completed_lessons = serializers.IntegerField()
    total_lessons = serializers.IntegerField()
    passed_quizzes = serializers.IntegerField()
    total_quizzes = serializers.IntegerField()
    percent = serializers.IntegerField()


class LearnCourseSerializer(serializers.Serializer):
    """Documents the shape of GET /learning/courses/<slug>/."""

    course = CourseListSerializer()
    status = serializers.CharField()
    progress = ProgressSerializer()
    last_lesson = serializers.IntegerField(allow_null=True)
    certificate = serializers.CharField(allow_null=True)
    modules = ModuleContentSerializer(many=True)


class ProgressUpdateSerializer(serializers.Serializer):
    position_seconds = serializers.IntegerField(min_value=0, required=False)
    completed = serializers.BooleanField(required=False, default=False)


class ProgressUpdateResponseSerializer(serializers.Serializer):
    lesson = serializers.IntegerField()
    completed = serializers.BooleanField()
    position_seconds = serializers.IntegerField()
    course_progress = ProgressSerializer()
    course_completed = serializers.BooleanField()
    certificate = serializers.CharField(allow_null=True)


class LearningSummarySerializer(serializers.Serializer):
    enrolled_courses = serializers.IntegerField()
    completed_courses = serializers.IntegerField()
    completed_lessons = serializers.IntegerField()
    certificates = serializers.IntegerField()
    streak = serializers.IntegerField()
    xp = serializers.IntegerField()
