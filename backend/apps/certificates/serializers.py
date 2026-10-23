from rest_framework import serializers

from .models import Certificate


class CertificateSerializer(serializers.ModelSerializer):
    course = serializers.CharField(source="course.slug", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    student_name = serializers.CharField(source="student.name", read_only=True)

    class Meta:
        model = Certificate
        fields = ["code", "course", "course_title", "student_name", "issued_at", "pdf"]


class CertificateVerificationSerializer(serializers.ModelSerializer):
    """Public view used by employers to verify a certificate; no private data."""

    valid = serializers.SerializerMethodField()
    course_title = serializers.CharField(source="course.title", read_only=True)
    student_name = serializers.CharField(source="student.name", read_only=True)

    class Meta:
        model = Certificate
        fields = ["valid", "code", "student_name", "course_title", "issued_at"]

    def get_valid(self, obj) -> bool:
        return True
