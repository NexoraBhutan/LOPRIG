from django.urls import path

from .views import ChangePasswordView, MeView

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("me/password/", ChangePasswordView.as_view(), name="change-password"),
]
