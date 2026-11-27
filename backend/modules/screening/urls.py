from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ScreeningBookingViewSet, ScreeningCenterViewSet

router = DefaultRouter()
router.register("centers", ScreeningCenterViewSet, basename="screening-center")
router.register("bookings", ScreeningBookingViewSet, basename="screening-booking")

urlpatterns = [
    path("", include(router.urls)),
]

