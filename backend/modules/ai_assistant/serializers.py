from rest_framework import serializers
from .models import Conversation, KnowledgeDocument, LearningInsight, Message


class KnowledgeDocumentSerializer(serializers.ModelSerializer):
    reviewed_by_name = serializers.CharField(source="reviewed_by.name", read_only=True, default="")
    chunk_count = serializers.IntegerField(source="chunks.count", read_only=True)

    class Meta:
        model = KnowledgeDocument
        fields = [
            "id", "title", "source", "document_type", "language", "content",
            "review_status", "reviewed_by", "reviewed_by_name", "chunk_count",
            "published_at", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "reviewed_by", "published_at", "created_at", "updated_at"]


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "conversation", "role", "content", "sources", "metadata", "created_at"]
        read_only_fields = ["id", "conversation", "role", "sources", "metadata", "created_at"]


class ConversationSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(source="messages.count", read_only=True)

    class Meta:
        model = Conversation
        fields = ["id", "title", "thread_id", "language", "message_count", "created_at", "updated_at"]
        read_only_fields = ["id", "thread_id", "created_at", "updated_at"]


class ConversationDetailSerializer(ConversationSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta(ConversationSerializer.Meta):
        fields = ConversationSerializer.Meta.fields + ["messages"]


class LearningInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = LearningInsight
        fields = [
            "id", "question_pattern", "suggested_answer", "language",
            "insight_type", "hit_count", "helpful_votes", "status",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "hit_count", "helpful_votes", "created_at", "updated_at"]
