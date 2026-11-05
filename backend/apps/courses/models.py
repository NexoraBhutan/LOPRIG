import uuid
from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction
from django.db.models import Count, DecimalField, Q, Sum
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.db.models.functions import Coalesce
from django.utils import timezone


def cover_upload_path(instance, filename: str) -> str:
    """Random name: the uploader's file name isn't kept."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    return f"course-covers/{uuid.uuid4().hex}.{ext}"


class Category(models.Model):
    slug = models.SlugField(max_length=60, unique=True)
    title = models.CharField(max_length=100)
    icon = models.CharField(max_length=40, help_text="Icon name used by the frontend, e.g. Code.")
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "categories"
        ordering = ["order", "title"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.title


class CourseQuerySet(models.QuerySet):
    def published(self):
        return self.filter(status=Course.Status.PUBLISHED)

    def with_stats(self):
        """Adds lessons_count, total_seconds and effective_price for listing, sorting and filtering."""
        return self.annotate(
            lessons_count=Count("modules__lessons", distinct=True),
            total_seconds=Coalesce(Sum("modules__lessons__duration_seconds"), 0),
            effective_price=Coalesce(
                "discount_price", "price", output_field=DecimalField(max_digits=10, decimal_places=2)
            ),
        )


class Course(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING_REVIEW = "PENDING_REVIEW", "Pending review"
        PUBLISHED = "PUBLISHED", "Published"
        REJECTED = "REJECTED", "Rejected"

    class Level(models.TextChoices):
        BEGINNER = "Beginner"
        INTERMEDIATE = "Intermediate"
        ADVANCED = "Advanced"
        ALL_LEVELS = "All Levels"

    slug = models.SlugField(max_length=120, unique=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="courses")
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="courses_taught",
        limit_choices_to={"role": "TEACHER"},
    )
    level = models.CharField(max_length=20, choices=Level.choices, default=Level.BEGINNER)
    language = models.CharField(max_length=40, default="English")

    price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0"), validators=[MinValueValidator(0)])
    discount_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)]
    )

    requirements = models.JSONField(default=list, blank=True)
    what_you_learn = models.JSONField(default=list, blank=True)

    thumbnail_url = models.URLField(blank=True)
    cover_image = models.FileField(upload_to=cover_upload_path, blank=True, help_text="Card image uploaded by the teacher.")
    gradient_start = models.CharField(max_length=7, default="#ffb606")
    gradient_end = models.CharField(max_length=7, default="#c88e00")
    bestseller = models.BooleanField(default=False)

    # Denormalized stats; students_count is kept up to date by the enrollment service.
    rating = models.DecimalField(
        max_digits=2, decimal_places=1, default=Decimal("0"),
        validators=[MinValueValidator(0), MaxValueValidator(5)],
    )
    students_count = models.PositiveIntegerField(default=0)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT, db_index=True)
    review_note = models.TextField(blank=True, help_text="Why the course was rejected, shown to the teacher.")
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CourseQuerySet.as_manager()

    class Meta:
        db_table = "courses"
        ordering = ["-published_at", "-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(discount_price__isnull=True) | Q(discount_price__lte=models.F("price")),
                name="discount_not_above_price",
            ),
        ]

    def __str__(self):
        return self.title

    @property
    def current_price(self) -> Decimal:
        return self.discount_price if self.discount_price is not None else self.price

    @property
    def student_price(self) -> Decimal:
        """What a student pays today: nothing while payments are switched off."""
        return self.current_price if settings.PAYMENTS_ENABLED else Decimal("0")

    @property
    def is_free(self) -> bool:
        return self.student_price == 0

    def publish(self):
        self.status = self.Status.PUBLISHED
        self.review_note = ""
        if self.published_at is None:
            self.published_at = timezone.now()


class CourseModule(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    title = models.CharField(max_length=200)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "course_modules"
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.course.title} / {self.title}"


class Lesson(models.Model):
    class Kind(models.TextChoices):
        VIDEO = "VIDEO", "Video"
        TEXT = "TEXT", "Study material"
        H5P = "H5P", "Interactive (H5P)"

    class VideoStatus(models.TextChoices):
        NONE = "", "No upload"
        UPLOADING = "UPLOADING", "Uploading"
        PROCESSING = "PROCESSING", "Processing"
        READY = "READY", "Ready"
        FAILED = "FAILED", "Failed"

    module = models.ForeignKey(CourseModule, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=200)
    order = models.PositiveSmallIntegerField(default=0)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.VIDEO)
    duration_seconds = models.PositiveIntegerField(default=0)
    is_preview = models.BooleanField(default=False, help_text="Visible to everyone, enrolled or not.")

    # Content. Videos live in object storage / a streaming service; only the reference is stored here.
    # Either an uploaded Bunny Stream video (video_id) or a pasted link (video_url, e.g. YouTube).
    video_url = models.URLField(blank=True)
    video_id = models.CharField(max_length=64, blank=True, db_index=True, help_text="Bunny Stream video ID.")
    video_status = models.CharField(max_length=10, choices=VideoStatus.choices, blank=True, default="")
    body = models.TextField(blank=True, help_text="Study material for TEXT lessons.")
    h5p_embed_url = models.URLField(blank=True)

    class Meta:
        db_table = "lessons"
        ordering = ["order", "id"]

    def __str__(self):
        return self.title

    @property
    def course(self):
        return self.module.course

    @property
    def has_video(self) -> bool:
        return bool(self.video_url or self.video_id)

    def refresh_video_status(self) -> None:
        """Ask Bunny how the upload is doing; fills in the duration once it's known."""
        from . import video

        if not self.video_id:
            return
        status, length = video.fetch_status(self.video_id)
        self.video_status = status
        if length:
            self.duration_seconds = length
        self.save(update_fields=["video_status", "duration_seconds"])


@receiver(post_delete, sender=Lesson)
def _delete_uploaded_video(sender, instance, **kwargs):
    """Deleting a lesson (or its module/course) removes its video from Bunny too, so no orphan costs."""
    if instance.video_id:
        from . import video

        transaction.on_commit(lambda: video.delete_video(instance.video_id))


class LessonResource(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="resources")
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to="lesson-resources/", blank=True)
    url = models.URLField(blank=True)

    class Meta:
        db_table = "lesson_resources"
        ordering = ["id"]

    def __str__(self):
        return self.title
