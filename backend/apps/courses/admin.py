from django.contrib import admin, messages
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from unfold.admin import ModelAdmin, TabularInline
from unfold.decorators import action, display

from . import services
from .models import Category, Course, CourseModule, Lesson, LessonResource

STATUS_COLORS = {
    Course.Status.DRAFT.label: "info",
    Course.Status.PENDING_REVIEW.label: "warning",
    Course.Status.PUBLISHED.label: "success",
    Course.Status.REJECTED.label: "danger",
}


@admin.register(Category)
class CategoryAdmin(ModelAdmin):
    list_display = ["title", "slug", "icon", "order"]
    list_editable = ["order"]
    prepopulated_fields = {"slug": ["title"]}


class CourseModuleInline(TabularInline):
    model = CourseModule
    extra = 0
    show_change_link = True
    tab = True


@admin.register(Course)
class CourseAdmin(ModelAdmin):
    list_display = ["title", "show_teacher", "category", "show_status", "show_price", "students_count", "published_at"]
    list_filter = ["status", "category", "level"]
    list_filter_submit = True
    list_select_related = ["teacher", "category"]
    search_fields = ["title", "teacher__name", "teacher__email"]
    prepopulated_fields = {"slug": ["title"]}
    autocomplete_fields = ["teacher"]
    readonly_fields = ["status", "students_count", "published_at", "created_at", "updated_at"]
    inlines = [CourseModuleInline]
    actions = ["approve_courses", "reject_courses"]
    actions_detail = ["approve_detail", "reject_detail"]
    fieldsets = (
        ("Course", {"fields": ("title", "slug", "teacher", "category", "level", "language", "description")}),
        ("Pricing (Nu.)", {"fields": ("price", "discount_price")}),
        ("Outcomes", {"fields": ("what_you_learn", "requirements")}),
        ("Appearance", {"fields": ("thumbnail_url", "gradient_start", "gradient_end", "bestseller")}),
        ("Review", {"fields": ("status", "review_note", "published_at")}),
        ("Stats", {"fields": ("rating", "students_count", "created_at", "updated_at")}),
    )

    @display(description="Teacher", ordering="teacher__name")
    def show_teacher(self, obj):
        return obj.teacher.name

    @display(description="Status", label=STATUS_COLORS)
    def show_status(self, obj):
        return obj.get_status_display()

    @display(description="Price", ordering="price")
    def show_price(self, obj):
        return "Free" if obj.is_free else f"Nu. {obj.current_price:,.0f}"

    @admin.action(description="Approve and publish selected courses")
    def approve_courses(self, request, queryset):
        courses = list(queryset.exclude(status=Course.Status.PUBLISHED))
        for course in courses:
            services.approve(course)
        self.message_user(request, f"Published {len(courses)} course(s). Teachers were notified.", messages.SUCCESS)

    @admin.action(description="Reject selected courses (uses each course's review note)")
    def reject_courses(self, request, queryset):
        courses = list(queryset.exclude(status=Course.Status.REJECTED))
        for course in courses:
            services.reject(course)
        self.message_user(request, f"Rejected {len(courses)} course(s). Teachers were notified.", messages.WARNING)

    @action(description="Approve & publish", url_path="approve", icon="check_circle")
    def approve_detail(self, request, object_id):
        course = get_object_or_404(Course, pk=object_id)
        services.approve(course)
        self.message_user(request, f"“{course.title}” is published. The teacher was notified.", messages.SUCCESS)
        return redirect(reverse("admin:courses_course_change", args=[object_id]))

    @action(description="Reject", url_path="reject", icon="block")
    def reject_detail(self, request, object_id):
        course = get_object_or_404(Course, pk=object_id)
        if not course.review_note:
            self.message_user(
                request, "Write the reason in “Review note” and save first, so the teacher knows what to fix.",
                messages.ERROR,
            )
        else:
            services.reject(course)
            self.message_user(request, f"“{course.title}” was rejected. The teacher was notified.", messages.WARNING)
        return redirect(reverse("admin:courses_course_change", args=[object_id]))


class LessonInline(TabularInline):
    model = Lesson
    extra = 0
    fields = ["order", "title", "kind", "duration_seconds", "is_preview"]
    show_change_link = True


@admin.register(CourseModule)
class CourseModuleAdmin(ModelAdmin):
    list_display = ["title", "course", "order"]
    list_filter = ["course"]
    search_fields = ["title", "course__title"]
    inlines = [LessonInline]


class LessonResourceInline(TabularInline):
    model = LessonResource
    extra = 0


@admin.register(Lesson)
class LessonAdmin(ModelAdmin):
    list_display = ["title", "module", "kind", "duration_seconds", "is_preview"]
    list_filter = ["kind", "is_preview", "module__course"]
    search_fields = ["title", "module__course__title"]
    inlines = [LessonResourceInline]
