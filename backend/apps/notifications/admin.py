from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(ModelAdmin):
    list_display = ["title", "user", "kind", "read_at", "created_at"]
    list_filter = ["kind"]
    search_fields = ["title", "user__email"]
    raw_id_fields = ["user"]
