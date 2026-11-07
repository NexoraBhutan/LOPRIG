from rest_framework import serializers

from apps.courses.models import Course
from apps.courses.serializers import CourseListSerializer

from .models import Enrollment, SavedCourse


class EnrollmentSerializer(serializers.ModelSerializer):
    """An enrollment with its course and progress (completed_lessons / total_lessons)."""

    course = CourseListSerializer(read_only=True)
    completed_lessons = serializers.IntegerField(read_only=True)
    total_lessons = serializers.IntegerField(read_only=True)
    progress = serializers.SerializerMethodField()
    last_lesson = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            "id", "course", "status", "progress", "completed_lessons", "total_lessons",
            "last_lesson", "activated_at", "completed_at",
        ]

    def get_progress(self, obj) -> int:
        total = getattr(obj, "total_lessons", 0)
        percent = round(100 * obj.completed_lessons / total) if total else 0
        # All lessons watched but a chapter quiz still to pass: not finished yet.
        return 99 if percent == 100 and obj.status != Enrollment.Status.COMPLETED else percent


class EnrollmentStatusSerializer(serializers.ModelSerializer):
    course = serializers.CharField(source="course.slug", read_only=True)

    class Meta:
        model = Enrollment
        fields = ["id", "course", "status", "activated_at", "completed_at"]


class CourseSlugSerializer(serializers.Serializer):
    course = serializers.SlugRelatedField(slug_field="slug", queryset=Course.objects.published())


class SavedCourseSerializer(serializers.ModelSerializer):
    course = CourseListSerializer(read_only=True)

    class Meta:
        model = SavedCourse
        fields = ["course", "created_at"]
