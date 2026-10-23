from django.conf import settings
from django.db import models


class Enrollment(models.Model):
    """A student's relationship with a course. Paid courses start as PENDING_PAYMENT."""

    class Status(models.TextChoices):
        PENDING_PAYMENT = "PENDING_PAYMENT", "Pending payment"
        ACTIVE = "ACTIVE", "Active"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    ACCESS_STATUSES = (Status.ACTIVE, Status.COMPLETED)

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="enrollments")
    course = models.ForeignKey("courses.Course", on_delete=models.PROTECT, related_name="enrollments")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING_PAYMENT, db_index=True)
    last_lesson = models.ForeignKey("courses.Lesson", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    activated_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "enrollments"
        ordering = ["-updated_at"]
        constraints = [models.UniqueConstraint(fields=["student", "course"], name="one_enrollment_per_course")]

    def __str__(self):
        return f"{self.student_id} -> {self.course_id} ({self.status})"

    @property
    def has_access(self) -> bool:
        return self.status in self.ACCESS_STATUSES


class SavedCourse(models.Model):
    """'Save for later' wishlist."""

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_courses")
    course = models.ForeignKey("courses.Course", on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "saved_courses"
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["student", "course"], name="save_course_once")]
