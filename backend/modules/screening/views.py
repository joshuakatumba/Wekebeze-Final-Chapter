import math
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.concurrency import rw_lock
from core.permissions import IsPlatformAdmin
from core.services import log_audit
from .models import ScreeningBooking, ScreeningCenter
from .serializers import ScreeningBookingSerializer, ScreeningCenterSerializer


def haversine_km(lat1, lng1, lat2, lng2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 2)


class ScreeningCenterViewSet(viewsets.ModelViewSet):
    serializer_class = ScreeningCenterSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ("list", "retrieve", "districts", "nearby"):
            return [permissions.AllowAny()]
        # Strictly Admin-only for screening center mutations (Educators cannot modify centers)
        return [IsPlatformAdmin()]

    def list(self, request, *args, **kwargs):
        with rw_lock("screening:centers", mode="read"):
            return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        with rw_lock("screening:centers", mode="write"):
            obj = serializer.save(verified_at=timezone.now() if serializer.validated_data.get("is_verified", True) else None)
            log_audit(self.request, "screening.center.create", "ScreeningCenter", obj.id, {"name": obj.name})

    def perform_update(self, serializer):
        with rw_lock("screening:centers", mode="write"):
            obj = serializer.save()
            log_audit(self.request, "screening.center.update", "ScreeningCenter", obj.id, {"name": obj.name})

    def perform_destroy(self, instance):
        with rw_lock("screening:centers", mode="write"):
            log_audit(self.request, "screening.center.delete", "ScreeningCenter", instance.id, {"name": instance.name})
            instance.delete()

    def get_queryset(self):
        qs = ScreeningCenter.objects.prefetch_related("services").all()
        user = self.request.user
        if not (user.is_authenticated and (user.is_platform_admin or user.role == "provider")):
            qs = qs.filter(status=ScreeningCenter.Status.ACTIVE)
        district = self.request.query_params.get("district")
        search = self.request.query_params.get("search")
        if district and district != "All":
            qs = qs.filter(district__iexact=district)
        if search:
            qs = qs.filter(name__icontains=search) | qs.filter(location__icontains=search) | qs.filter(district__icontains=search)
        return qs

    @action(detail=False, methods=["get"], url_path="districts")
    def districts(self, request):
        names = (
            ScreeningCenter.objects.filter(status=ScreeningCenter.Status.ACTIVE)
            .values_list("district", flat=True)
            .distinct()
            .order_by("district")
        )
        return Response(list(names))

    @action(detail=False, methods=["get"], url_path="nearby")
    def nearby(self, request):
        try:
            lat = float(request.query_params.get("lat"))
            lng = float(request.query_params.get("lng"))
            radius_km = float(request.query_params.get("radius_km", 50))
        except (TypeError, ValueError):
            return Response({"error": "Valid lat and lng query parameters are required."}, status=status.HTTP_400_BAD_REQUEST)

        results = []
        for center in self.get_queryset():
            dist = haversine_km(lat, lng, center.latitude, center.longitude)
            if dist <= radius_km:
                center.distance_km = dist
                results.append(center)
        results.sort(key=lambda c: c.distance_km)
        return Response(ScreeningCenterSerializer(results, many=True).data)


class ScreeningBookingViewSet(viewsets.ModelViewSet):
    """Screening appointment & callback bookings (supports guest + authenticated users; admin manages all)."""

    serializer_class = ScreeningBookingSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action == "create":
            return [permissions.AllowAny()]
        if self.action in ("update", "partial_update", "destroy"):
            return [IsPlatformAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = ScreeningBooking.objects.select_related("center", "user").all()
        user = self.request.user
        if not (user.is_authenticated and user.is_platform_admin):
            qs = qs.filter(user=user)
        status_f = self.request.query_params.get("status")
        if status_f:
            qs = qs.filter(status=status_f)
        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        booking = serializer.save(user=user, status=ScreeningBooking.Status.PENDING)
        if user:
            log_audit(
                self.request,
                "screening.booking.create",
                "ScreeningBooking",
                booking.id,
                {"center": booking.center.name, "source": booking.source},
            )

    def perform_update(self, serializer):
        booking = serializer.save()
        log_audit(
            self.request,
            "screening.booking.update",
            "ScreeningBooking",
            booking.id,
            {"status": booking.status},
        )

