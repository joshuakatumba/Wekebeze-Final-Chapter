from django.db import transaction
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from .concurrency import ConcurrencyBusyError, distributed_mutex
from .models import AppConfig, AuditLog, Notification, UploadedFile
from .permissions import IsOwnerOrAdmin, IsPlatformAdmin
from .serializers import AppConfigSerializer, AuditLogSerializer, NotificationSerializer, UploadedFileSerializer
from .services import log_audit


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_view(request):
    return Response({"status": "ok"})


@api_view(["GET", "PATCH"])
@permission_classes([permissions.AllowAny])
def app_config_view(request):
    if request.method == "GET":
        cfg = AppConfig.load()
        return Response(AppConfigSerializer(cfg).data)

    if not (request.user and request.user.is_authenticated and request.user.is_platform_admin):
        return Response({"detail": "Admin permission required."}, status=status.HTTP_403_FORBIDDEN)

    try:
        with distributed_mutex("core:app_config", ttl_seconds=10):
            with transaction.atomic():
                cfg = AppConfig.objects.select_for_update().filter(pk=1).first() or AppConfig.load()
                serializer = AppConfigSerializer(cfg, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                log_audit(request, "config.updated", "AppConfig", 1)
                return Response(serializer.data)
    except ConcurrencyBusyError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)


class UploadedFileViewSet(viewsets.ModelViewSet):
    serializer_class = UploadedFileSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        if self.request.user.is_platform_admin:
            return UploadedFile.objects.all()
        return UploadedFile.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        f = self.request.FILES.get("file")
        instance = serializer.save(
            owner=self.request.user,
            original_name=getattr(f, "name", "file"),
            mime_type=getattr(f, "content_type", ""),
            size_bytes=getattr(f, "size", 0),
        )
        log_audit(self.request, "file.uploaded", "UploadedFile", instance.id)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save(update_fields=["is_read"])
        return Response(NotificationSerializer(notif).data)

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"status": "ok"})


class AuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsPlatformAdmin]
    queryset = AuditLog.objects.select_related("actor").all()

