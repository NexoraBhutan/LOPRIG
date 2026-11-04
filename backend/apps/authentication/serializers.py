from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.users.models import User
from apps.users.serializers import UserSerializer


class RegisterSerializer(serializers.Serializer):
    """Public sign-up always creates a STUDENT; teachers and admins are created by an admin."""

    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name cannot be empty.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate(self, attrs):
        try:
            validate_password(attrs["password"], User(email=attrs["email"], name=attrs["name"]))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(role=User.Role.STUDENT, **validated_data)


class LoginSerializer(TokenObtainPairSerializer):
    """Email + password -> access/refresh tokens, plus the user so the client needs no second call."""

    def validate(self, attrs):
        attrs[self.username_field] = attrs[self.username_field].strip().lower()
        data = super().validate(attrs)
        if self.user.is_site_admin:
            # Site administrators have their own sign-in (Django Admin) and no website account.
            raise AuthenticationFailed(
                "This is a site administration account. Sign in at the site administration page instead.",
                code="site_admin_account",
            )
        data["user"] = UserSerializer(self.user).data
        return data


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """The 6-digit code from the reset email, plus the new password."""

    email = serializers.EmailField()
    code = serializers.RegexField(r"^\s*\d{6}\s*$", error_messages={"invalid": "Enter the 6-digit code from the email."})
    new_password = serializers.CharField(write_only=True)


class AuthResponseSerializer(serializers.Serializer):
    """Documents the shape returned by register and login."""

    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()
