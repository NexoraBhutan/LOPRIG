import re

from django.utils.text import slugify
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.courses import video
from apps.courses.models import Category, Course, CourseModule, Lesson, LessonResource, QuizQuestion
from apps.courses.serializers import cover_url, format_duration
from apps.courses.services import review_problems
from apps.enrollments.models import Enrollment
from apps.payments.files import check_image

HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def unique_slug(title: str) -> str:
    base = slugify(title)[:100] or "course"
    slug, n = base, 2
    while Course.objects.filter(slug=slug).exists():
        slug, n = f"{base}-{n}", n + 1
    return slug


class TeacherResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonResource
        fields = ["id", "title", "url"]
        extra_kwargs = {"url": {"required": True, "allow_blank": False}}


class PlaybackSerializer(serializers.Serializer):
    source = serializers.ChoiceField(choices=["", "BUNNY", "YOUTUBE", "VIMEO", "FILE"])
    url = serializers.CharField()


class TeacherLessonSerializer(serializers.ModelSerializer):
    resources = TeacherResourceSerializer(many=True, read_only=True)
    duration_seconds = serializers.IntegerField(min_value=0, max_value=6 * 3600, required=False)
    has_upload = serializers.SerializerMethodField()
    playback = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            "id", "title", "order", "kind", "duration_seconds", "is_preview",
            "video_url", "body", "h5p_embed_url", "resources",
            "has_upload", "video_status", "playback",
        ]
        read_only_fields = ["id", "video_status"]

    def validate_video_url(self, value):
        if value and (problem := video.youtube_embed_problem(value)):
            raise serializers.ValidationError(problem)
        return value

    def get_has_upload(self, obj) -> bool:
        return bool(obj.video_id)

    @extend_schema_field(PlaybackSerializer)
    def get_playback(self, obj) -> dict:
        # Teachers preview their own lessons; admins use this to watch during course review.
        return video.playback(obj)

    def update(self, instance, validated_data):
        # Pasting a link replaces an uploaded video: remove the upload so it stops costing storage.
        if validated_data.get("video_url") and instance.video_id:
            video.delete_video(instance.video_id)
            instance.video_id, instance.video_status = "", Lesson.VideoStatus.NONE
        return super().update(instance, validated_data)


class TeacherModuleSerializer(serializers.ModelSerializer):
    lessons = TeacherLessonSerializer(many=True, read_only=True)
    quiz = serializers.SerializerMethodField()

    class Meta:
        model = CourseModule
        fields = ["id", "title", "order", "lessons", "quiz"]
        read_only_fields = ["id"]

    def get_quiz(self, obj) -> dict | None:
        quiz = getattr(obj, "quiz", None)
        if quiz is None:
            return None
        return {"id": quiz.id, "title": quiz.title, "pass_percent": quiz.pass_percent,
                "questions_count": quiz.questions.count()}


class QuizQuestionInputSerializer(serializers.Serializer):
    """Multiple choice (options + the correct one) or written (the student types; the teacher marks)."""

    kind = serializers.ChoiceField(choices=QuizQuestion.Kind.choices, default=QuizQuestion.Kind.CHOICE)
    prompt = serializers.CharField(max_length=1000, trim_whitespace=True)
    options = serializers.ListField(
        child=serializers.CharField(max_length=300, trim_whitespace=True), required=False, default=list, max_length=6,
        error_messages={"max_length": "Use at most 6 options."},
    )
    correct = serializers.IntegerField(min_value=0, required=False, allow_null=True, default=None)
    model_answer = serializers.CharField(max_length=2000, required=False, allow_blank=True, trim_whitespace=True)
    explanation = serializers.CharField(max_length=1000, required=False, allow_blank=True, trim_whitespace=True)

    def validate(self, attrs):
        if attrs["kind"] == QuizQuestion.Kind.WRITTEN:
            attrs["options"], attrs["correct"] = [], None
            return attrs
        attrs["model_answer"] = ""
        if len(attrs["options"]) < 2:
            raise serializers.ValidationError({"options": "Give at least 2 answer options."})
        if attrs["correct"] is None or attrs["correct"] >= len(attrs["options"]):
            raise serializers.ValidationError({"correct": "Choose which option is the right answer."})
        return attrs


class QuizInputSerializer(serializers.Serializer):
    """The whole chapter quiz, saved in one go (questions are replaced)."""

    title = serializers.CharField(max_length=200, trim_whitespace=True)
    pass_percent = serializers.IntegerField(min_value=1, max_value=100)
    questions = QuizQuestionInputSerializer(many=True, allow_empty=False, max_length=50,
                                            error_messages={"empty": "Add at least one question."})


class TeacherCourseSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="slug", read_only=True)
    category = serializers.SlugRelatedField(slug_field="slug", queryset=Category.objects.all())
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, coerce_to_string=False)
    discount_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0, coerce_to_string=False, allow_null=True, required=False
    )
    requirements = serializers.ListField(child=serializers.CharField(max_length=300), required=False, max_length=20)
    what_you_learn = serializers.ListField(child=serializers.CharField(max_length=300), required=False, max_length=20)
    enrolled = serializers.IntegerField(read_only=True, default=0)
    lessons_count = serializers.IntegerField(read_only=True, default=0)
    duration = serializers.SerializerMethodField()
    # Set through the cover upload endpoint, not this form.
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id", "title", "description", "category", "level", "language", "price", "discount_price",
            "requirements", "what_you_learn", "thumbnail_url", "gradient_start", "gradient_end",
            "status", "review_note", "published_at", "students_count", "enrolled", "lessons_count",
            "duration", "created_at", "updated_at",
        ]
        read_only_fields = ["status", "review_note", "published_at", "students_count", "created_at", "updated_at"]

    def get_duration(self, obj) -> str:
        return format_duration(getattr(obj, "total_seconds", 0))

    def get_thumbnail_url(self, obj) -> str:
        return cover_url(obj, self.context.get("request"))

    def validate_title(self, value):
        value = value.strip()
        if len(value) < 5:
            raise serializers.ValidationError("Use a title of at least 5 characters.")
        return value

    def validate_gradient_start(self, value):
        if not HEX_COLOR.match(value):
            raise serializers.ValidationError("Use a hex colour like #ffb606.")
        return value

    validate_gradient_end = validate_gradient_start

    def validate(self, attrs):
        price = attrs.get("price", getattr(self.instance, "price", 0))
        discount = attrs.get("discount_price", getattr(self.instance, "discount_price", None))
        if discount is not None and discount > price:
            raise serializers.ValidationError({"discount_price": "The sale price can't be higher than the price."})
        return attrs

    def create(self, validated_data):
        validated_data["slug"] = unique_slug(validated_data["title"])
        return super().create(validated_data)


class TeacherCourseDetailSerializer(TeacherCourseSerializer):
    modules = TeacherModuleSerializer(many=True, read_only=True)
    review_problems = serializers.SerializerMethodField()

    class Meta(TeacherCourseSerializer.Meta):
        fields = TeacherCourseSerializer.Meta.fields + ["modules", "review_problems"]

    def get_review_problems(self, obj) -> list[str]:
        return review_problems(obj)


class CourseCoverSerializer(serializers.Serializer):
    image = serializers.FileField()

    def validate_image(self, value):
        return check_image(value, "image", max_mb=5)


class StudentProgressSerializer(serializers.ModelSerializer):
    """One student in a teacher's course, with their progress."""

    name = serializers.CharField(source="student.name")
    email = serializers.EmailField(source="student.email")
    avatar_color = serializers.CharField(source="student.avatar_color")
    avatar = serializers.CharField(source="student.avatar_url")
    completed_lessons = serializers.IntegerField()
    progress = serializers.SerializerMethodField()
    last_activity = serializers.DateTimeField(source="updated_at")

    class Meta:
        model = Enrollment
        fields = ["id", "name", "email", "avatar_color", "avatar", "status", "progress", "completed_lessons",
                  "activated_at", "last_activity"]

    def get_progress(self, obj) -> int:
        total = self.context.get("total_lessons", 0)
        return round(100 * obj.completed_lessons / total) if total else 0
