from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    GoogleSignInView,
    LoginView,
    LogoutEverywhereView,
    LogoutView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("google/", GoogleSignInView.as_view(), name="google-sign-in"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("logout-all/", LogoutEverywhereView.as_view(), name="logout-all"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]
