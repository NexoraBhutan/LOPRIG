from django.apps import AppConfig


class PlatformAdminConfig(AppConfig):
    """Admin portal API (/api/v1/manage/). Named to avoid clashing with django.contrib.admin."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.platform_admin"
