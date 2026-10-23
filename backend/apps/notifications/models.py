from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Kind(models.TextChoices):
        ENROLLMENT = "ENROLLMENT", "Enrollment"
        PAYMENT = "PAYMENT", "Payment"
        COURSE_COMPLETED = "COURSE_COMPLETED", "Course completed"
        SYSTEM = "SYSTEM", "System"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.SYSTEM)
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True)
    data = models.JSONField(default=dict, blank=True, help_text="Extra context for the client, e.g. a course id.")
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "read_at"])]

    def __str__(self):
        return f"{self.user_id}: {self.title}"
