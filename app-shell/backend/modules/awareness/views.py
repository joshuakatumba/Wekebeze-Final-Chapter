from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from core.concurrency import ConcurrencyBusyError, distributed_mutex
from core.permissions import IsPlatformAdmin, has_role
from core.services import log_audit
from .models import AwarenessArticle, AwarenessCategory, GuidedChatNode, GuidedChatProgress, PublishStatus
from .serializers import (
    AwarenessArticleSerializer,
    AwarenessCategorySerializer,
    GuidedChatNodeSerializer,
    GuidedChatProgressSerializer,
)

User = get_user_model()


class AwarenessCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = AwarenessCategorySerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [has_role("admin", "provider")()]

    def get_queryset(self):
        qs = AwarenessCategory.objects.all()
        user = self.request.user
        if not (user.is_authenticated and (user.is_platform_admin or user.role == "provider")):
            qs = qs.filter(status=PublishStatus.PUBLISHED)
        cancer_type = self.request.query_params.get("cancer_type")
        language = self.request.query_params.get("language")
        if cancer_type:
            qs = qs.filter(cancer_type=cancer_type)
        if language:
            qs = qs.filter(language=language)
        return qs

    def perform_create(self, serializer):
        obj = serializer.save()
        log_audit(self.request, "awareness.category.create", "AwarenessCategory", obj.id, {"name": obj.name})


class AwarenessArticleViewSet(viewsets.ModelViewSet):
    serializer_class = AwarenessArticleSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        return [has_role("admin", "provider")()]

    def get_queryset(self):
        qs = AwarenessArticle.objects.select_related("category", "author").all()
        user = self.request.user
        if not (user.is_authenticated and (user.is_platform_admin or user.role == "provider")):
            qs = qs.filter(status=PublishStatus.PUBLISHED)
        cancer_type = self.request.query_params.get("cancer_type")
        language = self.request.query_params.get("language")
        category = self.request.query_params.get("category")
        if cancer_type:
            qs = qs.filter(cancer_type=cancer_type)
        if language:
            qs = qs.filter(language=language)
        if category:
            qs = qs.filter(category_id=category)
        return qs

    def perform_create(self, serializer):
        obj = serializer.save(author=self.request.user)
        log_audit(self.request, "awareness.article.create", "AwarenessArticle", obj.id, {"title": obj.title})

    def perform_update(self, serializer):
        obj = serializer.save()
        log_audit(self.request, "awareness.article.update", "AwarenessArticle", obj.id, {"title": obj.title})

    def perform_destroy(self, instance):
        log_audit(self.request, "awareness.article.delete", "AwarenessArticle", instance.id, {"title": instance.title})
        instance.delete()


class GuidedChatNodeViewSet(viewsets.ModelViewSet):
    serializer_class = GuidedChatNodeSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ("list", "retrieve", "flow"):
            return [permissions.AllowAny()]
        return [has_role("admin", "provider")()]

    def get_queryset(self):
        qs = GuidedChatNode.objects.all()
        user = self.request.user
        if not (user.is_authenticated and (user.is_platform_admin or user.role == "provider")):
            qs = qs.filter(status=PublishStatus.PUBLISHED)
        cancer_type = self.request.query_params.get("cancer_type")
        language = self.request.query_params.get("language")
        if cancer_type:
            qs = qs.filter(cancer_type=cancer_type)
        if language:
            qs = qs.filter(language=language)
        return qs

    @action(detail=False, methods=["get"], url_path="flow")
    def flow(self, request):
        """Return guided decision-tree indexed by logical node_id plus start_node_id."""
        cancer_type = request.query_params.get("cancer_type", "breast")
        language = request.query_params.get("language", "en")
        nodes = list(
            GuidedChatNode.objects.filter(
                cancer_type=cancer_type, language=language, status=PublishStatus.PUBLISHED
            )
        )
        if not nodes and language != "en":
            nodes = list(
                GuidedChatNode.objects.filter(
                    cancer_type=cancer_type, language="en", status=PublishStatus.PUBLISHED
                )
            )
        node_map = {}
        start_node_id = None
        for n in nodes:
            node_map[n.node_id] = GuidedChatNodeSerializer(n).data
            if n.is_start and not start_node_id:
                start_node_id = n.node_id
        if not start_node_id and nodes:
            start_node_id = nodes[0].node_id
        return Response({
            "cancer_type": cancer_type,
            "language": language,
            "start_node_id": start_node_id,
            "nodes": node_map,
        })

    def perform_create(self, serializer):
        obj = serializer.save()
        log_audit(self.request, "guided_chat.node.create", "GuidedChatNode", obj.id, {"node_id": obj.node_id})

    def perform_update(self, serializer):
        obj = serializer.save()
        log_audit(self.request, "guided_chat.node.update", "GuidedChatNode", obj.id, {"node_id": obj.node_id})

    def perform_destroy(self, instance):
        log_audit(self.request, "guided_chat.node.delete", "GuidedChatNode", instance.id, {"node_id": instance.node_id})
        instance.delete()


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def guided_progress_view(request):
    if request.method == "GET":
        qs = GuidedChatProgress.objects.filter(user=request.user)
        return Response(GuidedChatProgressSerializer(qs, many=True).data)

    cancer_type = request.data.get("cancer_type", "breast")
    language = request.data.get("language", "en")
    node_id = request.data.get("current_node_id", "")
    completed = bool(request.data.get("completed", False))

    try:
        lock_key = f"guided_progress:{request.user.id}:{cancer_type}:{language}"
        with distributed_mutex(lock_key, ttl_seconds=10):
            with transaction.atomic():
                prog, _ = GuidedChatProgress.objects.select_for_update().get_or_create(
                    user=request.user, cancer_type=cancer_type, language=language
                )
                if node_id:
                    prog.current_node_id = node_id
                    visited = list(prog.visited_nodes or [])
                    if node_id not in visited:
                        visited.append(node_id)
                    prog.visited_nodes = visited
                if completed:
                    prog.completed = True
                prog.save()
                return Response(GuidedChatProgressSerializer(prog).data, status=status.HTTP_200_OK)
    except ConcurrencyBusyError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)


@api_view(["GET"])
@permission_classes([IsPlatformAdmin])
def platform_analytics_view(request):
    """Aggregated platform analytics for Administrators (never exposes private conversation content)."""
    from modules.quizzes.models import Quiz, QuizAttempt
    from modules.screening.models import ScreeningCenter
    from modules.ai_assistant.models import Conversation, KnowledgeDocument, Message

    since_30d = timezone.now() - timedelta(days=30)
    return Response({
        "users": {
            "total": User.objects.count(),
            "active": User.objects.filter(is_active=True).count(),
            "new_30d": User.objects.filter(date_joined__gte=since_30d).count(),
            "admins": User.objects.filter(role="admin").count(),
            "educators": User.objects.filter(role="provider").count(),
        },
        "awareness": {
            "categories": AwarenessCategory.objects.count(),
            "articles": AwarenessArticle.objects.count(),
            "guided_nodes": GuidedChatNode.objects.count(),
            "guided_completions": GuidedChatProgress.objects.filter(completed=True).count(),
        },
        "quizzes": {
            "total_quizzes": Quiz.objects.count(),
            "total_attempts": QuizAttempt.objects.count(),
        },
        "screening": {
            "total_centers": ScreeningCenter.objects.count(),
            "verified_centers": ScreeningCenter.objects.filter(is_verified=True).count(),
        },
        "ai_assistant": {
            "total_conversations": Conversation.objects.count(),
            "total_messages": Message.objects.count(),
            "knowledge_documents": KnowledgeDocument.objects.count(),
            "approved_documents": KnowledgeDocument.objects.filter(review_status="approved").count(),
        },
    })

