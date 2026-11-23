from django.db import transaction
from rest_framework import serializers
from core.concurrency import distributed_mutex
from .models import CenterService, ScreeningCenter


class CenterServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CenterService
        fields = ["id", "name", "price", "currency", "is_available"]
        read_only_fields = ["id"]


class ScreeningCenterSerializer(serializers.ModelSerializer):
    services = CenterServiceSerializer(many=True, required=False)
    distance_km = serializers.FloatField(read_only=True, required=False)

    class Meta:
        model = ScreeningCenter
        fields = [
            "id", "name", "district", "location", "description",
            "latitude", "longitude", "contact", "operating_hours",
            "is_verified", "verified_at", "status", "services",
            "distance_km", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    @transaction.atomic
    def create(self, validated_data):
        services_data = validated_data.pop("services", [])
        center = ScreeningCenter.objects.create(**validated_data)
        for s in services_data:
            CenterService.objects.create(center=center, **s)
        return center

    def update(self, instance, validated_data):
        services_data = validated_data.pop("services", None)
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

