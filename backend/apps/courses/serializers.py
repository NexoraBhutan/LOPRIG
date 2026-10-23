from rest_framework import serializers

from .models import Category, Course, CourseModule, Lesson


def format_duration(seconds: int) -> str:
    """12h 30m / 45m style, matching the frontend's course duration strings."""
    hours, rem = divmod(int(seconds or 0), 3600)
    minutes = rem // 60
    return f"{hours}h {minutes:02d}m" if hours else f"{minutes}m"


def format_clock(seconds: int) -> str:
    minutes, secs = divmod(int(seconds or 0), 60)
    return f"{minutes}:{secs:02d}"


class CategorySerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="slug", read_only=True)
    count = serializers.IntegerField(source="course_count", read_only=True)

    class Meta:
        model = Category
        fields = ["id", "title", "icon", "count"]


class InstructorSerializer(serializers.Serializer):
    name = serializers.CharField()
    title = serializers.CharField(source="headline")


class LessonOutlineSerializer(serializers.ModelSerializer):
    """Curriculum entry shown on the public course page: no content, just the outline."""

    duration = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = ["id", "title", "kind", "duration", "duration_seconds", "is_preview"]

    def get_duration(self, obj) -> str:
        return format_clock(obj.duration_seconds)


class ModuleOutlineSerializer(serializers.ModelSerializer):
    lessons = LessonOutlineSerializer(many=True, read_only=True)

    class Meta:
        model = CourseModule
        fields = ["id", "title", "lessons"]


class CourseListSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="slug", read_only=True)
    category = serializers.CharField(source="category.slug", read_only=True)
    instructor = InstructorSerializer(source="teacher", read_only=True)
    students = serializers.IntegerField(source="students_count", read_only=True)
    rating = serializers.FloatField(read_only=True)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False, read_only=True)
    discount_price = serializers.SerializerMethodField()
    lessons_count = serializers.IntegerField(read_only=True)
    duration = serializers.SerializerMethodField()
    gradient = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id", "title", "category", "level", "description", "instructor", "rating", "students",
            "duration", "lessons_count", "price", "discount_price", "language", "bestseller",
            "gradient", "thumbnail_url",
        ]

    def get_discount_price(self, obj) -> float:
        # The frontend always shows discountPrice as the price to pay.
        return float(obj.current_price)

    def get_duration(self, obj) -> str:
        return format_duration(obj.total_seconds)

    def get_gradient(self, obj) -> list[str]:
        return [obj.gradient_start, obj.gradient_end]


class CourseDetailSerializer(CourseListSerializer):
    curriculum = ModuleOutlineSerializer(source="modules", many=True, read_only=True)

    class Meta(CourseListSerializer.Meta):
        fields = CourseListSerializer.Meta.fields + ["requirements", "what_you_learn", "curriculum"]
