from django.urls import path

from .views import (
    CourseStudentsView,
    LessonCreateView,
    LessonDetailView,
    LessonVideoUploadView,
    LessonVideoView,
    ModuleCreateView,
    ModuleDetailView,
    ResourceCreateView,
    ResourceDeleteView,
    SubmitForReviewView,
    TeacherCourseDetailView,
    TeacherCourseListView,
    TeacherSummaryView,
)

urlpatterns = [
    path("summary/", TeacherSummaryView.as_view(), name="teach-summary"),
    path("courses/", TeacherCourseListView.as_view(), name="teach-course-list"),
    path("courses/<slug:slug>/", TeacherCourseDetailView.as_view(), name="teach-course-detail"),
    path("courses/<slug:slug>/submit/", SubmitForReviewView.as_view(), name="teach-course-submit"),
    path("courses/<slug:slug>/modules/", ModuleCreateView.as_view(), name="teach-module-create"),
    path("courses/<slug:slug>/students/", CourseStudentsView.as_view(), name="teach-course-students"),
    path("modules/<int:pk>/", ModuleDetailView.as_view(), name="teach-module-detail"),
    path("modules/<int:pk>/lessons/", LessonCreateView.as_view(), name="teach-lesson-create"),
    path("lessons/<int:pk>/", LessonDetailView.as_view(), name="teach-lesson-detail"),
    path("lessons/<int:pk>/video/", LessonVideoView.as_view(), name="teach-lesson-video"),
    path("lessons/<int:pk>/video/upload/", LessonVideoUploadView.as_view(), name="teach-lesson-video-upload"),
    path("lessons/<int:pk>/resources/", ResourceCreateView.as_view(), name="teach-resource-create"),
    path("resources/<int:pk>/", ResourceDeleteView.as_view(), name="teach-resource-delete"),
]
