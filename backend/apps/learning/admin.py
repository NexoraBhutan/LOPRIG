from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import ActivityDay, LessonProgress


@admin.register(LessonProgress)
class LessonProgressAdmin(ModelAdmin):
    list_display = ["enrollment", "lesson", "completed", "position_seconds", "updated_at"]
    list_filter = ["completed"]
    raw_id_fields = ["enrollment", "lesson"]


@admin.register(ActivityDay)
class ActivityDayAdmin(ModelAdmin):
    list_display = ["student", "day"]
    raw_id_fields = ["student"]
