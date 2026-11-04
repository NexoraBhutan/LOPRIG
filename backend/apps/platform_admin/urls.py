from django.urls import path

from .views import (
    AdminCourseDetailView,
    AdminCourseListView,
    AdminEnrollmentListView,
    AdminPaymentListView,
    AdminResetPasswordView,
    AdminUserDetailView,
    AdminUserListView,
    ApproveCourseView,
    ApprovePaymentView,
    PaymentProofView,
    QrSettingsAdminView,
    RejectPaymentView,
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
    path("users/<int:pk>/reset-password/", AdminResetPasswordView.as_view(), name="manage-user-reset-password"),
    path("enrollments/", AdminEnrollmentListView.as_view(), name="manage-enrollment-list"),
    path("payments/", AdminPaymentListView.as_view(), name="manage-payment-list"),
    path("payments/<str:reference>/approve/", ApprovePaymentView.as_view(), name="manage-payment-approve"),
    path("payments/<str:reference>/reject/", RejectPaymentView.as_view(), name="manage-payment-reject"),
    path("payments/<str:reference>/proof/", PaymentProofView.as_view(), name="manage-payment-proof"),
    path("payment-settings/", QrSettingsAdminView.as_view(), name="manage-payment-settings"),
]
