from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import Certificate


@admin.register(Certificate)
class CertificateAdmin(ModelAdmin):
    list_display = ["code", "student", "course", "issued_at"]
    search_fields = ["code", "student__email", "course__title"]
    raw_id_fields = ["enrollment", "student", "course"]
    readonly_fields = ["code", "issued_at"]
