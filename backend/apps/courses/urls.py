from django.urls import path

from .views import (
    BunnyStreamWebhookView,
    CategoryDetailView,
    CategoryListView,
    CourseDetailView,
    CourseListView,
    SiteConfigView,
)

urlpatterns = [
    path("categories/", CategoryListView.as_view(), name="category-list"),
    path("categories/<slug:slug>/", CategoryDetailView.as_view(), name="category-detail"),
    path("courses/", CourseListView.as_view(), name="course-list"),
    path("courses/<slug:slug>/", CourseDetailView.as_view(), name="course-detail"),
    path("config/", SiteConfigView.as_view(), name="site-config"),
    path("webhooks/bunny-stream/", BunnyStreamWebhookView.as_view(), name="bunny-stream-webhook"),
]
