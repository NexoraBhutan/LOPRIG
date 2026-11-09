from rest_framework import serializers

from .links import link_for
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()
    link = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "kind", "title", "message", "data", "link", "is_read", "read_at", "created_at"]

    def get_link(self, obj) -> str:
        return link_for(obj)

    def get_is_read(self, obj) -> bool:
        return obj.read_at is not None
