from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

api_v1 = [
    path("auth/", include("apps.authentication.urls")),
    path("users/", include("apps.users.urls")),
    path("", include("apps.courses.urls")),
    path("", include("apps.enrollments.urls")),
    path("learning/", include("apps.learning.urls")),
    path("payments/", include("apps.payments.urls")),
    path("certificates/", include("apps.certificates.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("teach/", include("apps.teaching.urls")),
    path("manage/", include("apps.platform_admin.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
elif settings.SERVE_MEDIA:
    # Photos and course covers; payment screenshots stay private (served to admins via the API).
    urlpatterns += [
        re_path(r"^media/(?P<path>(?!payment-proofs/).+)$", serve, {"document_root": settings.MEDIA_ROOT}),
    ]

admin.site.site_header = "Lop-rig administration"
admin.site.site_title = "Lop-rig admin"
