import uuid
from django.conf import settings
from django.db import models


class CancerType(models.TextChoices):
    BREAST = "breast", "Breast Cancer"
    CERVICAL = "cervical", "Cervical Cancer"
    PROSTATE = "prostate", "Prostate Cancer"


class Language(models.TextChoices):
    EN = "en", "English"
    LG = "lg", "Luganda"


class PublishStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    ARCHIVED = "archived", "Archived"


class AwarenessCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=80)
    cancer_type = models.CharField(max_length=20, choices=CancerType.choices)
    language = models.CharField(max_length=10, choices=Language.choices, default=Language.EN)
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    image_url = models.CharField(max_length=300, blank=True)
    order = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=PublishStatus.choices, default=PublishStatus.PUBLISHED)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "name"]
        unique_together = ("slug", "language")

    def __str__(self):
        return f"{self.name} ({self.language})"


class AwarenessArticle(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(AwarenessCategory, on_delete=models.CASCADE, related_name="articles")
    cancer_type = models.CharField(max_length=20, choices=CancerType.choices)
    language = models.CharField(max_length=10, choices=Language.choices, default=Language.EN)
    title = models.CharField(max_length=220)
    summary = models.TextField(blank=True)
    content = models.TextField()
    image_url = models.CharField(max_length=300, blank=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="awareness_articles"
    )
    status = models.CharField(max_length=20, choices=PublishStatus.choices, default=PublishStatus.PUBLISHED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.language})"


class GuidedChatNode(models.Model):
    """Decision-tree educational chat node keyed by logical node_id (not DB UUID)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cancer_type = models.CharField(max_length=20, choices=CancerType.choices)
    language = models.CharField(max_length=10, choices=Language.choices, default=Language.EN)
    node_id = models.CharField(max_length=100, db_index=True)
    is_start = models.BooleanField(default=False)
    title = models.CharField(max_length=180, blank=True)
    text = models.TextField()
    image = models.CharField(max_length=255, blank=True)
    options = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=PublishStatus.choices, default=PublishStatus.PUBLISHED)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("cancer_type", "language", "node_id")
        ordering = ["cancer_type", "language", "-is_start", "node_id"]

    def __str__(self):
        return f"{self.cancer_type}/{self.language}:{self.node_id}"


class GuidedChatProgress(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="guided_progress")
    cancer_type = models.CharField(max_length=20, choices=CancerType.choices)
    language = models.CharField(max_length=10, choices=Language.choices, default=Language.EN)
    current_node_id = models.CharField(max_length=100, blank=True)
    visited_nodes = models.JSONField(default=list, blank=True)
    completed = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "cancer_type", "language")
        ordering = ["-updated_at"]


class HealthReminder(models.Model):
    class ReminderType(models.TextChoices):
        BREAST_SELF_EXAM = "breast_self_exam", "Monthly Breast Self-Exam"
        CERVICAL_SCREENING = "cervical_screening", "Cervical Cancer Screening"
        HPV_FOLLOWUP = "hpv_followup", "HPV Vaccination / Follow-up"
        CUSTOM = "custom", "Custom Reminder"

    class Frequency(models.TextChoices):
        MONTHLY = "monthly", "Monthly"
        QUARTERLY = "quarterly", "Quarterly"
        ANNUAL = "annual", "Annual"

    class Channel(models.TextChoices):
        IN_APP = "in_app", "In-App"
        WHATSAPP = "whatsapp", "WhatsApp"
        SMS = "sms", "SMS"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="health_reminders")
    reminder_type = models.CharField(max_length=32, choices=ReminderType.choices, default=ReminderType.BREAST_SELF_EXAM)
    title = models.CharField(max_length=160)
    frequency = models.CharField(max_length=20, choices=Frequency.choices, default=Frequency.MONTHLY)
    next_due_date = models.DateField()
    channel = models.CharField(max_length=20, choices=Channel.choices, default=Channel.IN_APP)
    phone = models.CharField(max_length=40, blank=True)
    is_active = models.BooleanField(default=True)
    last_completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["next_due_date", "-created_at"]

    def __str__(self):
        return f"{self.title} ({self.user.email} — due {self.next_due_date})"

