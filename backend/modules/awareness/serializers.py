from rest_framework import serializers
from .models import AwarenessArticle, AwarenessCategory, GuidedChatNode, GuidedChatProgress


class AwarenessArticleSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    author_name = serializers.CharField(source="author.name", read_only=True, default="")

    class Meta:
        model = AwarenessArticle
        fields = [
            "id", "category", "category_name", "cancer_type", "language",
            "title", "summary", "content", "image_url", "author", "author_name",
            "status", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "author", "created_at", "updated_at"]


class AwarenessCategorySerializer(serializers.ModelSerializer):
    article_count = serializers.IntegerField(source="articles.count", read_only=True)

    class Meta:
        model = AwarenessCategory
        fields = [
            "id", "slug", "cancer_type", "language", "name",
            "description", "image_url", "order", "status", "article_count", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class GuidedChatNodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = GuidedChatNode
        fields = [
            "id", "cancer_type", "language", "node_id", "is_start",
            "title", "text", "image", "options", "status", "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]


class GuidedChatProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = GuidedChatProgress
        fields = [
            "id", "cancer_type", "language", "current_node_id",
            "visited_nodes", "completed", "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]

