from django.db.models import Count, Max, Sum
from django.db.models.functions import Coalesce
from rest_framework import serializers

from apps.courses.models import Lesson
from apps.courses.serializers import format_duration
from apps.learning.models import QuizAttempt

from .models import Certificate


class CertificateSerializer(serializers.ModelSerializer):
    course = serializers.CharField(source="course.slug", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    student_name = serializers.CharField(source="student.name", read_only=True)

    class Meta:
        model = Certificate
        fields = ["code", "course", "course_title", "student_name", "issued_at", "pdf"]


class CertificateVerificationSerializer(serializers.ModelSerializer):
    """Public: what the certificate page shows and what employers verify. No private data (no email)."""

    valid = serializers.SerializerMethodField()
    course = serializers.CharField(source="course.slug", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    student_name = serializers.CharField(source="student.name", read_only=True)
    instructor_name = serializers.CharField(source="course.teacher.name", read_only=True)
    lessons_count = serializers.SerializerMethodField()
    duration = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    assessment = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = ["valid", "code", "student_name", "course", "course_title", "instructor_name",
                  "lessons_count", "duration", "skills", "assessment", "issued_at"]

    def get_skills(self, obj) -> list[str]:
        """What the student learned: the course's outcomes, or else its chapter titles."""
        outcomes = [s for s in (obj.course.what_you_learn or []) if s]
        if not outcomes:
            outcomes = list(obj.course.modules.order_by("order").values_list("title", flat=True))
        return outcomes[:6]

    def get_assessment(self, obj) -> dict | None:
        """Average of the student's best chapter quiz scores, when the course has quizzes."""
        best = (QuizAttempt.objects.filter(enrollment_id=obj.enrollment_id, score__isnull=False)
                .values("quiz").annotate(best=Max("score")).values_list("best", flat=True))
        scores = list(best)
        if not scores:
            return None
        return {"average": round(sum(scores) / len(scores)), "quizzes": len(scores)}

    def _stats(self, obj) -> dict:
        if not hasattr(obj, "_course_stats"):
            obj._course_stats = Lesson.objects.filter(module__course_id=obj.course_id).aggregate(
                count=Count("id"), seconds=Coalesce(Sum("duration_seconds"), 0))
        return obj._course_stats

    def get_valid(self, obj) -> bool:
        return True

    def get_lessons_count(self, obj) -> int:
        return self._stats(obj)["count"]

    def get_duration(self, obj) -> str:
        seconds = self._stats(obj)["seconds"]
        return format_duration(seconds) if seconds >= 60 else ""  # never print "0m"
