from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payments.files import check_image

from .serializers import ChangePasswordSerializer, ProfileUpdateSerializer, UserSerializer

AVATAR_MAX_MB = 3


class MeView(APIView):
    """The signed-in user's own profile."""

    @extend_schema(responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    @extend_schema(request=ProfileUpdateSerializer, responses=UserSerializer)
    def patch(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class AvatarUploadSerializer(serializers.Serializer):
    image = serializers.FileField()

    def validate_image(self, value):
        return check_image(value, "image", max_mb=AVATAR_MAX_MB)


class AvatarView(APIView):
    """POST: upload a profile photo (replaces the old one). DELETE: remove it, falling back to the
    Google picture or the initial."""

    parser_classes = [MultiPartParser, FormParser]

    def _set(self, user, image):
        old = user.avatar.name if user.avatar else None
        user.avatar = image
        user.save(update_fields=["avatar"])
        if old:
            user.avatar.storage.delete(old)
        return Response(UserSerializer(user).data)

    @extend_schema(request={"multipart/form-data": AvatarUploadSerializer}, responses=UserSerializer)
    def post(self, request):
        serializer = AvatarUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self._set(request.user, serializer.validated_data["image"])

    @extend_schema(responses=UserSerializer)
    def delete(self, request):
        return self._set(request.user, None)


class ChangePasswordView(APIView):
    @extend_schema(request=ChangePasswordSerializer, responses={204: None})
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_own_password(serializer.validated_data["new_password"])
        return Response(status=status.HTTP_204_NO_CONTENT)
