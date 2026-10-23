from django.urls import path

from .views import LearnCourseView, LearningSummaryView, LessonDetailView, LessonProgressView

urlpatterns = [
    path("summary/", LearningSummaryView.as_view(), name="learning-summary"),
    path("courses/<slug:slug>/", LearnCourseView.as_view(), name="learn-course"),
    path("lessons/<int:pk>/", LessonDetailView.as_view(), name="learn-lesson"),
    path("lessons/<int:pk>/progress/", LessonProgressView.as_view(), name="lesson-progress"),
]
