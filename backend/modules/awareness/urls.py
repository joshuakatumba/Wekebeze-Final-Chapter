from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    AwarenessArticleViewSet,
    AwarenessCategoryViewSet,
    GuidedChatNodeViewSet,
    HealthReminderViewSet,
    educator_stats_view,
    guided_progress_view,
    platform_analytics_export_view,
    platform_analytics_view,
)

router = DefaultRouter()
router.register("categories", AwarenessCategoryViewSet, basename="awareness-category")
router.register("articles", AwarenessArticleViewSet, basename="awareness-article")
router.register("guided-nodes", GuidedChatNodeViewSet, basename="guided-node")
router.register("reminders", HealthReminderViewSet, basename="health-reminder")

urlpatterns = [
    path("progress/", guided_progress_view, name="guided-progress"),
    path("educator-stats/", educator_stats_view, name="educator-stats"),
    path("analytics/", platform_analytics_view, name="platform-analytics"),
    path("analytics/export/", platform_analytics_export_view, name="platform-analytics-export"),
    path("", include(router.urls)),
]

