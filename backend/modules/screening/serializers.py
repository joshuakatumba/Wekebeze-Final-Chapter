import re
from django.db import transaction
from rest_framework import serializers
from core.concurrency import distributed_mutex
from .models import CenterService, ScreeningBooking, ScreeningCenter


def _extract_coords_from_url(url: str):
    if not url:
        return None
    for pat in (r"@(-?\d+\.\d+),(-?\d+\.\d+)", r"[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)"):
        m = re.search(pat, url)
        if m:
            return float(m.group(1)), float(m.group(2))
    return None


class CenterServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CenterService
        fields = ["id", "name", "price", "currency", "is_available"]
        read_only_fields = ["id"]


class ScreeningCenterSerializer(serializers.ModelSerializer):
    services = CenterServiceSerializer(many=True, required=False)
    distance_km = serializers.FloatField(read_only=True, required=False)
    share_url = serializers.SerializerMethodField()

    class Meta:
        model = ScreeningCenter
        fields = [
            "id", "name", "district", "location", "description",
            "latitude", "longitude", "map_url", "share_url", "contact", "operating_hours",
            "is_verified", "verified_at", "status", "services",
            "distance_km", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "share_url", "created_at", "updated_at"]

    def get_share_url(self, obj):
        if obj.map_url:
            return obj.map_url
        return f"https://www.google.com/maps?q={obj.latitude},{obj.longitude}"

    def _sync_location(self, validated_data, instance=None):
        map_url = validated_data.get("map_url")
        if map_url:
            coords = _extract_coords_from_url(map_url)
            if coords:
                validated_data["latitude"], validated_data["longitude"] = coords
        lat = validated_data.get("latitude", getattr(instance, "latitude", 0.3476))
        lng = validated_data.get("longitude", getattr(instance, "longitude", 32.5825))
        if not map_url and not getattr(instance, "map_url", ""):
            validated_data["map_url"] = f"https://www.google.com/maps?q={lat},{lng}"

    @transaction.atomic
    def create(self, validated_data):
        services_data = validated_data.pop("services", [])
        self._sync_location(validated_data)
        center = ScreeningCenter.objects.create(**validated_data)
        for s in services_data:
            CenterService.objects.create(center=center, **s)
        return center

    def update(self, instance, validated_data):
        services_data = validated_data.pop("services", None)
        self._sync_location(validated_data, instance=instance)
        with distributed_mutex(f"screening_center:{instance.id}", ttl_seconds=10):
            with transaction.atomic():
                locked = ScreeningCenter.objects.select_for_update().get(pk=instance.pk)
                for attr, val in validated_data.items():
                    setattr(locked, attr, val)
                locked.save()
                if services_data is not None:
                    locked.services.all().delete()
                    for s in services_data:
                        CenterService.objects.create(center=locked, **s)
                return locked


class ScreeningBookingSerializer(serializers.ModelSerializer):
    center_name = serializers.CharField(source="center.name", read_only=True)
    center_district = serializers.CharField(source="center.district", read_only=True)
    center_contact = serializers.CharField(source="center.contact", read_only=True)

    class Meta:
        model = ScreeningBooking
        fields = [
            "id", "center", "center_name", "center_district", "center_contact",
            "user", "full_name", "phone", "preferred_date", "service_name",
            "notes", "status", "source", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "user", "created_at", "updated_at"]

