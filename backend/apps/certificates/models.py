import secrets

from django.conf import settings
from django.db import models


def generate_code() -> str:
    """Human-friendly verification code, e.g. LR-7F3A-91C2."""
    raw = secrets.token_hex(4).upper()
    return f"LR-{raw[:4]}-{raw[4:]}"


class Certificate(models.Model):
    enrollment = models.OneToOneField("enrollments.Enrollment", on_delete=models.PROTECT, related_name="certificate")
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="certificates")
    course = models.ForeignKey("courses.Course", on_delete=models.PROTECT, related_name="certificates")
    code = models.CharField(max_length=20, unique=True, default=generate_code, editable=False)
    # Filled in by a background PDF job once Celery is added; the record itself is the proof.
    pdf = models.FileField(upload_to="certificates/", blank=True)
    issued_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "certificates"
        ordering = ["-issued_at"]

    def __str__(self):
        return f"{self.code} ({self.student_id} / {self.course_id})"
