from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Count, DecimalField, Q, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone


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
    def is_free(self) -> bool:
        return self.current_price == 0

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

    module = models.ForeignKey(CourseModule, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=200)
    order = models.PositiveSmallIntegerField(default=0)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.VIDEO)
    duration_seconds = models.PositiveIntegerField(default=0)
    is_preview = models.BooleanField(default=False, help_text="Visible to everyone, enrolled or not.")

    # Content. Videos live in object storage / a streaming service; only the reference is stored here.
    video_url = models.URLField(blank=True)
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
