from django.urls import path

from .views import AvatarView, ChangePasswordView, MeView

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("me/avatar/", AvatarView.as_view(), name="me-avatar"),
    path("me/password/", ChangePasswordView.as_view(), name="change-password"),
]
