from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    AwarenessArticleViewSet,
    AwarenessCategoryViewSet,
    GuidedChatNodeViewSet,
    guided_progress_view,
    platform_analytics_view,
)

router = DefaultRouter()
router.register("categories", AwarenessCategoryViewSet, basename="awareness-category")
router.register("articles", AwarenessArticleViewSet, basename="awareness-article")
router.register("guided-nodes", GuidedChatNodeViewSet, basename="guided-node")

urlpatterns = [
    path("progress/", guided_progress_view, name="guided-progress"),
    path("analytics/", platform_analytics_view, name="platform-analytics"),
    path("", include(router.urls)),
]

