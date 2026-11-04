from rest_framework import serializers

from apps.courses.models import Course
from apps.courses.serializers import format_duration
from apps.enrollments.models import Enrollment
from apps.payments.files import check_image
from apps.payments.models import Payment, PaymentSettings
from apps.teaching.serializers import TeacherModuleSerializer
from apps.users.models import User


# Roles the admin portal can hand out. Site administrators (Django Admin) are created only with
# `manage.py createsuperuser`, so a website admin can never grant raw-data access.
PORTAL_ROLES = [(value, label) for value, label in User.Role.choices if value != User.Role.SITE_ADMIN]


class AdminUserSerializer(serializers.ModelSerializer):
    # Annotated as *_count because User already has `enrollments` / courses relations.
    enrollments = serializers.IntegerField(source="enrollment_count", read_only=True, default=0)
    courses = serializers.IntegerField(source="course_count", read_only=True, default=0)
    role = serializers.ChoiceField(choices=PORTAL_ROLES, required=False)

    class Meta:
        model = User
        fields = ["id", "name", "email", "role", "headline", "is_active", "avatar_color",
                  "date_joined", "last_login", "enrollments", "courses",
                  "must_change_password", "password_changed_at"]
        read_only_fields = ["id", "email", "avatar_color", "date_joined", "last_login",
                            "must_change_password", "password_changed_at"]

    def validate(self, attrs):
        me = self.context["request"].user
        if self.instance and self.instance.pk == me.pk:
            if attrs.get("role", me.role) != User.Role.ADMIN or attrs.get("is_active", True) is False:
                raise serializers.ValidationError("You can't remove your own admin access.")
        return attrs


class AdminUserCreateSerializer(serializers.Serializer):
    """Admins create teacher (and admin) accounts; students sign up themselves.

    There is no password field: the user is emailed a temporary password (see the view).
    """

    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=PORTAL_ROLES, default=User.Role.TEACHER)
    headline = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def create(self, validated_data):
        return User.objects.create_user(password=None, **validated_data)  # unusable until emailed


class AdminCourseSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="slug", read_only=True)
    teacher = serializers.CharField(source="teacher.name", read_only=True)
    teacher_email = serializers.CharField(source="teacher.email", read_only=True)
    category = serializers.CharField(source="category.title", read_only=True)
    price = serializers.SerializerMethodField()
    enrolled = serializers.IntegerField(read_only=True, default=0)
    completed = serializers.IntegerField(read_only=True, default=0)
    lessons_count = serializers.IntegerField(read_only=True, default=0)
    duration = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = ["id", "title", "teacher", "teacher_email", "category", "level", "status", "review_note",
                  "price", "enrolled", "completed", "lessons_count", "duration", "gradient_start",
                  "gradient_end", "published_at", "updated_at"]

    def get_price(self, obj) -> float:
        return float(obj.current_price)

    def get_duration(self, obj) -> str:
        return format_duration(getattr(obj, "total_seconds", 0))


class AdminCourseDetailSerializer(AdminCourseSerializer):
    modules = TeacherModuleSerializer(many=True, read_only=True)
    review_problems = serializers.ListField(child=serializers.CharField(), read_only=True)

    class Meta(AdminCourseSerializer.Meta):
        fields = AdminCourseSerializer.Meta.fields + [
            "description", "language", "what_you_learn", "requirements", "modules", "review_problems",
        ]


class AdminEnrollmentSerializer(serializers.ModelSerializer):
    student = serializers.CharField(source="student.name")
    student_email = serializers.CharField(source="student.email")
    course = serializers.CharField(source="course.title")
    course_id = serializers.CharField(source="course.slug")
    completed_lessons = serializers.IntegerField()
    total_lessons = serializers.IntegerField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = ["id", "student", "student_email", "course", "course_id", "status", "progress",
                  "completed_lessons", "total_lessons", "activated_at", "completed_at", "created_at"]

    def get_progress(self, obj) -> int:
        return round(100 * obj.completed_lessons / obj.total_lessons) if obj.total_lessons else 0


class AdminPaymentSerializer(serializers.ModelSerializer):
    student = serializers.CharField(source="student.name")
    student_email = serializers.CharField(source="student.email")
    course = serializers.CharField(source="course.title")
    course_id = serializers.CharField(source="course.slug")
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, coerce_to_string=False)
    has_proof = serializers.SerializerMethodField()
    reviewed_by = serializers.CharField(source="reviewed_by.name", default="", read_only=True)

    class Meta:
        model = Payment
        fields = ["reference", "student", "student_email", "course", "course_id", "amount", "currency",
                  "provider", "status", "failure_reason", "journal_number", "contact_number", "has_proof",
                  "reviewed_by", "reviewed_at", "paid_at", "created_at"]

    def get_has_proof(self, obj) -> bool:
        return bool(obj.proof)


class PaymentRejectSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=5, max_length=250, error_messages={
        "min_length": "Tell the student what was wrong (5+ characters).",
    })


class AdminQrSettingsSerializer(serializers.ModelSerializer):
    qr_image = serializers.FileField(required=False, write_only=True)
    qr_image_url = serializers.SerializerMethodField()
    ready = serializers.BooleanField(source="is_ready", read_only=True)

    class Meta:
        model = PaymentSettings
        fields = ["ready", "qr_image", "qr_image_url", "account_name", "bank_name", "account_number",
                  "instructions", "alert_email", "updated_at"]
        read_only_fields = ["updated_at"]

    def get_qr_image_url(self, obj) -> str:
        if not obj.qr_image:
            return ""
        request = self.context.get("request")
        return request.build_absolute_uri(obj.qr_image.url) if request else obj.qr_image.url

    def validate_qr_image(self, value):
        return check_image(value, "qr_image")

    def update(self, instance, validated_data):
        old = instance.qr_image.name if "qr_image" in validated_data and instance.qr_image else None
        instance = super().update(instance, validated_data)
        if old and old != instance.qr_image.name:
            instance.qr_image.storage.delete(old)
        return instance


class RejectSerializer(serializers.Serializer):
    note = serializers.CharField(min_length=10, error_messages={"min_length": "Explain what to fix (10+ characters)."})
