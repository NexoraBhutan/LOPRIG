from django.contrib import admin
from unfold.admin import ModelAdmin
from unfold.decorators import display

from .models import ActivityDay, LessonComment, LessonProgress, LessonView


@admin.register(LessonProgress)
class LessonProgressAdmin(ModelAdmin):
    list_display = ["enrollment", "lesson", "completed", "position_seconds", "updated_at"]
    list_filter = ["completed"]
    raw_id_fields = ["enrollment", "lesson"]


@admin.register(ActivityDay)
class ActivityDayAdmin(ModelAdmin):
    list_display = ["student", "day"]
    raw_id_fields = ["student"]


@admin.register(LessonComment)
class LessonCommentAdmin(ModelAdmin):
    """Comments under lessons. Delete anything abusive; replies go with the comment they answer."""

    list_display = ["show_body", "author", "lesson", "show_course", "show_reply", "created_at"]
    list_filter = [("lesson__module__course", admin.RelatedOnlyFieldListFilter)]
    list_select_related = ["author", "lesson__module__course"]
    search_fields = ["body", "author__name", "author__email", "lesson__title"]
    date_hierarchy = "created_at"
    raw_id_fields = ["lesson", "author", "parent"]

    def has_add_permission(self, request):
        return False

    @display(description="Comment")
    def show_body(self, obj):
        return obj.body if len(obj.body) <= 80 else f"{obj.body[:80]}…"

    @display(description="Course", ordering="lesson__module__course__title")
    def show_course(self, obj):
        return obj.lesson.module.course.title

    @display(description="Reply", boolean=True)
    def show_reply(self, obj):
        return obj.parent_id is not None


@admin.register(LessonView)
class LessonViewAdmin(ModelAdmin):
    """Who opened which lesson (one row per student per lesson). Read only."""

    list_display = ["student", "lesson", "show_course", "created_at"]
    list_filter = [("lesson__module__course", admin.RelatedOnlyFieldListFilter)]
    list_select_related = ["student", "lesson__module__course"]
    search_fields = ["student__name", "student__email", "lesson__title"]
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    @display(description="Course", ordering="lesson__module__course__title")
    def show_course(self, obj):
        return obj.lesson.module.course.title
