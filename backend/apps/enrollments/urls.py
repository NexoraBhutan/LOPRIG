from django.urls import path

from .views import (
    EnrollmentDetailView,
    EnrollmentListView,
    EnrollView,
    SavedCourseDeleteView,
    SavedCourseListView,
)

urlpatterns = [
    path("courses/<slug:slug>/enroll/", EnrollView.as_view(), name="course-enroll"),
    path("enrollments/", EnrollmentListView.as_view(), name="enrollment-list"),
    path("enrollments/<slug:slug>/", EnrollmentDetailView.as_view(), name="enrollment-detail"),
    path("saved-courses/", SavedCourseListView.as_view(), name="saved-course-list"),
    path("saved-courses/<slug:slug>/", SavedCourseDeleteView.as_view(), name="saved-course-delete"),
]
