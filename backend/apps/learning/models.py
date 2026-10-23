from django.conf import settings
from django.db import models


class LessonProgress(models.Model):
    """One row per (enrollment, lesson): how far the student got and whether they finished it."""

    enrollment = models.ForeignKey("enrollments.Enrollment", on_delete=models.CASCADE, related_name="lesson_progress")
    lesson = models.ForeignKey("courses.Lesson", on_delete=models.CASCADE, related_name="+")
    position_seconds = models.PositiveIntegerField(default=0, help_text="Video resume position.")
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "lesson_progress"
        constraints = [models.UniqueConstraint(fields=["enrollment", "lesson"], name="one_progress_per_lesson")]

    def __str__(self):
        return f"{self.enrollment_id} / {self.lesson_id} ({'done' if self.completed else self.position_seconds})"


class ActivityDay(models.Model):
    """A day on which the student learned something; drives the day streak."""

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="activity_days")
    day = models.DateField()

    class Meta:
        db_table = "learning_activity_days"
        ordering = ["-day"]
        constraints = [models.UniqueConstraint(fields=["student", "day"], name="one_activity_per_day")]
