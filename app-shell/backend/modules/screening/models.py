import uuid
from django.db import models


class ScreeningCenter(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=220)
    district = models.CharField(max_length=100, db_index=True)
    location = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    latitude = models.FloatField(default=0.3476)
    longitude = models.FloatField(default=32.5825)
    map_url = models.URLField(max_length=500, blank=True, default="")
    contact = models.CharField(max_length=100, blank=True)
    operating_hours = models.CharField(max_length=160, blank=True, default="Mon–Fri, 8:00 AM – 5:00 PM")
    is_verified = models.BooleanField(default=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["district", "name"]

    def __str__(self):
        return f"{self.name} ({self.district})"


class CenterService(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    center = models.ForeignKey(ScreeningCenter, on_delete=models.CASCADE, related_name="services")
    name = models.CharField(max_length=160)
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default="UGX")
    is_available = models.BooleanField(default=True)

    class Meta:
        ordering = ["price", "name"]

    def __str__(self):
        return f"{self.name} — {self.price} {self.currency}"

