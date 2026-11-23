from django.conf import settings
from django.db import models


class AppConfig(models.Model):
    """Singleton runtime configuration & feature flags."""

    app_name = models.CharField(max_length=120, default="AppShell")
    settings_json = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "shell_app_config"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class UploadedFile(models.Model):
    """Reusable file & document metadata table."""

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="uploaded_files")
    file = models.FileField(upload_to="uploads/%Y/%m/")
    original_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=120, blank=True, default="")
    size_bytes = models.PositiveBigIntegerField(default=0)
    category = models.CharField(max_length=60, blank=True, default="general")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "shell_uploaded_files"
        ordering = ["-created_at"]


class Notification(models.Model):
    """Reusable in-app notification model."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=200)
    message = models.TextField(blank=True, default="")
    channel = models.CharField(max_length=30, default="in_app")
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "shell_notifications"
        ordering = ["-created_at"]


class AuditLog(models.Model):
    """Reusable audit trail for security & compliance."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs"
    )
    action = models.CharField(max_length=120, db_index=True)
    target_type = models.CharField(max_length=80, blank=True, default="")
    target_id = models.CharField(max_length=64, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.CharField(max_length=45, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "shell_audit_logs"
        ordering = ["-created_at"]

