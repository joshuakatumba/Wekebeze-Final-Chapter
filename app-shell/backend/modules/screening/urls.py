from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ScreeningCenterViewSet

router = DefaultRouter()
router.register("centers", ScreeningCenterViewSet, basename="screening-center")

urlpatterns = [
    path("", include(router.urls)),
]

