from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema, inline_serializer
from rest_framework import generics, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(generics.ListAPIView):
    queryset = Notification.objects.none()  # schema hint; get_queryset() scopes to the user
    serializer_class = NotificationSerializer

    @extend_schema(parameters=[OpenApiParameter("unread", bool, description="Only unread notifications.")])
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        if self.request.query_params.get("unread") in ("1", "true", "True"):
            qs = qs.filter(read_at__isnull=True)
        return qs


class UnreadCountView(APIView):
    @extend_schema(responses=inline_serializer("UnreadCount", {"unread": serializers.IntegerField()}))
    def get(self, request):
        if request.user.is_student:
            from apps.learning.services import remind_to_continue  # learning depends on notifications
            remind_to_continue(request.user)
        count = Notification.objects.filter(user=request.user, read_at__isnull=True).count()
        return Response({"unread": count})


class MarkReadView(APIView):
    @extend_schema(request=None, responses=NotificationSerializer)
    def post(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, user=request.user)
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(NotificationSerializer(notification).data)


class MarkAllReadView(APIView):
    @extend_schema(request=None, responses=inline_serializer("MarkedRead", {"updated": serializers.IntegerField()}))
    def post(self, request):
        updated = Notification.objects.filter(user=request.user, read_at__isnull=True).update(read_at=timezone.now())
        return Response({"updated": updated})
