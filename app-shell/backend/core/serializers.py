from rest_framework import serializers
from .models import AppConfig, AuditLog, Notification, UploadedFile


class AppConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppConfig
        fields = ["app_name", "settings_json", "updated_at"]


class UploadedFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadedFile
        fields = ["id", "file", "original_name", "mime_type", "size_bytes", "category", "created_at"]
        read_only_fields = ["id", "original_name", "mime_type", "size_bytes", "created_at"]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "title", "message", "channel", "is_read", "created_at"]
        read_only_fields = ["id", "title", "message", "channel", "created_at"]


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.name", read_only=True, default="System")

    class Meta:
        model = AuditLog
        fields = ["id", "actor", "actor_name", "action", "target_type", "target_id", "metadata", "ip_address", "created_at"]
        read_only_fields = fields

