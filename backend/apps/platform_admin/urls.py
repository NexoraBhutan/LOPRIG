from django.urls import path

from .views import (
    AdminCourseDetailView,
    AdminCourseListView,
    AdminEnrollmentListView,
    AdminPaymentListView,
    AdminUserDetailView,
    AdminUserListView,
    ApproveCourseView,
    RejectCourseView,
    SummaryView,
)

urlpatterns = [
    path("summary/", SummaryView.as_view(), name="manage-summary"),
    path("courses/", AdminCourseListView.as_view(), name="manage-course-list"),
    path("courses/<slug:slug>/", AdminCourseDetailView.as_view(), name="manage-course-detail"),
    path("courses/<slug:slug>/approve/", ApproveCourseView.as_view(), name="manage-course-approve"),
    path("courses/<slug:slug>/reject/", RejectCourseView.as_view(), name="manage-course-reject"),
    path("users/", AdminUserListView.as_view(), name="manage-user-list"),
    path("users/<int:pk>/", AdminUserDetailView.as_view(), name="manage-user-detail"),
    path("enrollments/", AdminEnrollmentListView.as_view(), name="manage-enrollment-list"),
    path("payments/", AdminPaymentListView.as_view(), name="manage-payment-list"),
]
