import uuid
from django.conf import settings
from django.db import models


class KnowledgeDocument(models.Model):
    class ReviewStatus(models.TextChoices):
        DRAFT = "draft", "Draft"
        APPROVED = "approved", "Approved"
        ARCHIVED = "archived", "Archived"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=240)
    source = models.CharField(max_length=240, blank=True, default="Uganda Cancer Institute / WHO Guidelines")
    document_type = models.CharField(max_length=60, default="guideline")
    language = models.CharField(max_length=10, default="en")
    content = models.TextField()
    review_status = models.CharField(max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.DRAFT)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_knowledge_docs"
    )
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} [{self.review_status}]"


class KnowledgeChunk(models.Model):
    """Vector-embedded medical knowledge chunk with self-improving adaptive quality weights."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(KnowledgeDocument, on_delete=models.CASCADE, related_name="chunks")
    content = models.TextField()
    chunk_index = models.PositiveIntegerField(default=0)
    embedding = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    # Self-improvement adaptive metrics updated from real user feedback
    retrieval_count = models.PositiveIntegerField(default=0)
    helpful_count = models.PositiveIntegerField(default=0)
    unhelpful_count = models.PositiveIntegerField(default=0)
    quality_score = models.FloatField(default=1.0)

    class Meta:
        ordering = ["document", "chunk_index"]


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_conversations")
    title = models.CharField(max_length=200, default="New Conversation")
    thread_id = models.CharField(max_length=120, unique=True, default=uuid.uuid4)
    language = models.CharField(max_length=10, default="en")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.title} ({self.user_id})"


class Message(models.Model):
    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"
        SYSTEM = "system", "System"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=20, choices=Role.choices)
    content = models.TextField()
    sources = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class MessageFeedback(models.Model):
    """Per-message user feedback (+1 helpful / -1 unhelpful) driving adaptive RAG self-improvement."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="feedbacks")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_feedbacks")
    rating = models.SmallIntegerField(choices=[(1, "Helpful"), (-1, "Not Helpful")])
    comment = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("message", "user")
        ordering = ["-created_at"]


class LearningInsight(models.Model):
    """
    Self-improving memory queue: captures recurring unanswered questions (knowledge gaps)
    and highly-rated grounded Q&As so Health Educators can promote them into the vector DB.
    """

    class InsightType(models.TextChoices):
        KNOWLEDGE_GAP = "knowledge_gap", "Knowledge Gap"
        HIGH_RATED = "high_rated", "Highly Rated Answer"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending Review"
        PROMOTED = "promoted", "Promoted to Knowledge Base"
        DISMISSED = "dismissed", "Dismissed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question_pattern = models.CharField(max_length=320, db_index=True)
    suggested_answer = models.TextField(blank=True, default="")
    language = models.CharField(max_length=10, default="en")
    insight_type = models.CharField(max_length=20, choices=InsightType.choices, default=InsightType.KNOWLEDGE_GAP)
    hit_count = models.PositiveIntegerField(default=1)
    helpful_votes = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-helpful_votes", "-hit_count", "-updated_at"]
