from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    joined = serializers.DateTimeField(source="date_joined", read_only=True)
    # Uploaded photo or Google picture; empty means "show the initial". May be a relative /media/ URL.
    avatar = serializers.CharField(source="avatar_url", read_only=True)
    # False for accounts made with "Continue with Google" until they set a password.
    has_password = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "role", "bio", "avatar_color", "avatar", "joined", "must_change_password",
                  "has_password", "password_changed_at"]
        read_only_fields = ["id", "email", "role", "joined", "must_change_password", "password_changed_at"]

    def get_has_password(self, obj) -> bool:
        return obj.has_usable_password()


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["name", "bio", "avatar_color"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name cannot be empty.")
        return value


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context["request"].user)
        return value
