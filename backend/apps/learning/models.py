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


class LessonView(models.Model):
    """A student opened a lesson. One row per student per lesson, so a lesson's views are its
    unique viewers and refreshing the page never inflates the count."""

    lesson = models.ForeignKey("courses.Lesson", on_delete=models.CASCADE, related_name="views")
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "lesson_views"
        constraints = [models.UniqueConstraint(fields=["lesson", "student"], name="one_view_per_student")]


class LessonComment(models.Model):
    """A comment under a lesson, or a reply to one (replies are one level deep)."""

    BODY_MAX = 2000

    lesson = models.ForeignKey("courses.Lesson", on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lesson_comments")
    parent = models.ForeignKey("self", on_delete=models.CASCADE, null=True, blank=True, related_name="replies")
    body = models.TextField(max_length=BODY_MAX)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "lesson_comments"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.author_id} on lesson {self.lesson_id}: {self.body[:40]}"


class ActivityDay(models.Model):
    """A day on which the student learned something; drives the day streak."""

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="activity_days")
    day = models.DateField()

    class Meta:
        db_table = "learning_activity_days"
        ordering = ["-day"]
        constraints = [models.UniqueConstraint(fields=["student", "day"], name="one_activity_per_day")]


class QuizAttempt(models.Model):
    """One try at a chapter quiz. A student may retry; their best attempt counts.

    Multiple-choice answers are graded on submit. When the quiz has written questions the attempt
    waits (PENDING, no score) until the teacher marks them, then becomes REVIEWED.
    """

    class Status(models.TextChoices):
        GRADED = "GRADED", "Graded automatically"
        PENDING = "PENDING", "Waiting for review"
        REVIEWED = "REVIEWED", "Reviewed by the teacher"

    enrollment = models.ForeignKey("enrollments.Enrollment", on_delete=models.CASCADE, related_name="quiz_attempts")
    quiz = models.ForeignKey("courses.Quiz", on_delete=models.CASCADE, related_name="attempts")
    answers = models.JSONField(
        default=list, help_text="Per question: the chosen option index (null = skipped), or the written answer text.",
    )
    questions = models.JSONField(
        default=list, blank=True,
        help_text="The questions as they were when submitted, so later quiz edits can't change what is marked.",
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.GRADED)
    score = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Percent correct; empty until marked.")
    passed = models.BooleanField(default=False)
    marks = models.JSONField(
        default=dict, blank=True, help_text='Teacher marks of written answers: {"<question id>": {"correct", "feedback"}}.',
    )
    feedback = models.TextField(blank=True, max_length=2000, help_text="The teacher's overall comment.")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "quiz_attempts"
        ordering = ["-created_at"]
