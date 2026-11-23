from django.urls import include, path
from rest_framework.routers import DefaultRouter
from . import views

app_name = "core"

router = DefaultRouter()
router.register(r"files", views.UploadedFileViewSet, basename="file")
router.register(r"notifications", views.NotificationViewSet, basename="notification")

urlpatterns = [
    path("health/", views.health_view, name="health"),
    path("config/", views.app_config_view, name="app-config"),
    path("audit-logs/", views.AuditLogListView.as_view(), name="audit-logs"),
    path("", include(router.urls)),
]

