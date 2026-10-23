from django.contrib import admin
from unfold.admin import ModelAdmin
from unfold.decorators import display

from .models import Enrollment, SavedCourse


@admin.register(Enrollment)
class EnrollmentAdmin(ModelAdmin):
    list_display = ["student", "course", "show_status", "activated_at", "completed_at", "created_at"]
    list_filter = ["status", "course"]
    list_filter_submit = True
    search_fields = ["student__email", "student__name", "course__title"]
    raw_id_fields = ["student", "course", "last_lesson"]
    readonly_fields = ["activated_at", "completed_at", "created_at", "updated_at"]

    @display(
        description="Status",
        label={"Active": "info", "Completed": "success", "Pending payment": "warning", "Cancelled": "danger"},
    )
    def show_status(self, obj):
        return obj.get_status_display()


@admin.register(SavedCourse)
class SavedCourseAdmin(ModelAdmin):
    list_display = ["student", "course", "created_at"]
    raw_id_fields = ["student", "course"]
