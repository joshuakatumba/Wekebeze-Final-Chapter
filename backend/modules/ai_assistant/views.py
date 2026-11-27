import json
from django.db import transaction
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.renderers import BaseRenderer, JSONRenderer
from rest_framework.response import Response


class EventStreamRenderer(BaseRenderer):
    media_type = "text/event-stream"
    format = "sse"
    charset = "utf-8"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data

from core.concurrency import ConcurrencyBusyError, bounded_semaphore, distributed_mutex
from core.permissions import has_role
from core.services import log_audit
from .graph import run_chat_graph
from .models import Conversation, KnowledgeDocument, LearningInsight, Message, MessageFeedback
from .rag import apply_feedback_learning, ingest_document
from .serializers import (
    ConversationDetailSerializer,
    ConversationSerializer,
    KnowledgeDocumentSerializer,
    LearningInsightSerializer,
    MessageSerializer,
)


class ConversationViewSet(viewsets.ModelViewSet):
    """Strictly user-owned AI conversations protected by per-conversation mutex & inference semaphore."""

    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Conversation.objects.filter(user=self.request.user).prefetch_related("messages")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ConversationDetailSerializer
        return ConversationSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["get", "post"], url_path="messages", renderer_classes=[JSONRenderer, EventStreamRenderer])
    def messages(self, request, pk=None):
        conversation = self.get_object()
        if request.method == "GET":
            return Response(MessageSerializer(conversation.messages.all(), many=True).data)

        content = (request.data.get("content") or "").strip()
        language = request.data.get("language") or conversation.language or "en"
        if not content:
            return Response({"error": "Message content is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with distributed_mutex(f"ai:conv:{conversation.id}", ttl_seconds=30):
                with bounded_semaphore("ai:inference", max_concurrent=10, ttl_seconds=35):
                    with transaction.atomic():
                        locked_conv = Conversation.objects.select_for_update().get(pk=conversation.pk)
                        if locked_conv.messages.count() == 0 and locked_conv.title == "New Conversation":
                            locked_conv.title = content[:60] + ("…" if len(content) > 60 else "")
                            locked_conv.language = language
                            locked_conv.save(update_fields=["title", "language", "updated_at"])

                        history = [
                            {"role": m.role, "content": m.content}
                            for m in locked_conv.messages.order_by("created_at")
                        ]
                        user_msg = Message.objects.create(
                            conversation=locked_conv,
                            role=Message.Role.USER,
                            content=content,
                        )

                    result = run_chat_graph(content, language=language, history=history)
                    assistant_text = result.get("response", "")
                    sources = result.get("sources", [])
                    is_urgent = bool(result.get("is_urgent", False))
                    recommended_centers = result.get("recommended_centers", [])

                    with transaction.atomic():
                        locked_conv = Conversation.objects.select_for_update().get(pk=conversation.pk)
                        assistant_msg = Message.objects.create(
                            conversation=locked_conv,
                            role=Message.Role.ASSISTANT,
                            content=assistant_text,
                            sources=sources,
                            metadata={
                                "language": result.get("language", language),
                                "is_urgent": is_urgent,
                                "recommended_centers": recommended_centers,
                            },
                        )
                        locked_conv.updated_at = timezone.now()
                        locked_conv.save(update_fields=["updated_at"])
                        final_title = locked_conv.title
        except ConcurrencyBusyError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        want_stream = (
            request.query_params.get("stream") == "1"
            or "text/event-stream" in request.META.get("HTTP_ACCEPT", "")
        )
        if want_stream:
            def event_stream():
                words = assistant_text.split(" ")
                for i in range(0, len(words), 4):
                    chunk = " ".join(words[i : i + 4]) + (" " if i + 4 < len(words) else "")
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'user_message': MessageSerializer(user_msg).data, 'assistant_message': MessageSerializer(assistant_msg).data, 'conversation_title': final_title}, default=str)}\n\n"

            resp = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
            resp["Cache-Control"] = "no-cache"
            resp["X-Accel-Buffering"] = "no"
            return resp

        return Response({
            "user_message": MessageSerializer(user_msg).data,
            "assistant_message": MessageSerializer(assistant_msg).data,
            "conversation_title": final_title,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="feedback")
    def feedback(self, request, pk=None):
        """Record user 👍 (+1) / 👎 (-1) feedback to self-improve retrieval rankings and learning insights."""
        conversation = self.get_object()
        message_id = request.data.get("message_id")
        try:
            rating = int(request.data.get("rating", 0))
        except (TypeError, ValueError):
            rating = 0
        if rating not in (1, -1):
            return Response({"error": "rating must be 1 or -1."}, status=status.HTTP_400_BAD_REQUEST)

        msg = conversation.messages.filter(id=message_id, role=Message.Role.ASSISTANT).first()
        if not msg:
            return Response({"error": "Assistant message not found."}, status=status.HTTP_404_NOT_FOUND)

        MessageFeedback.objects.update_or_create(
            message=msg, user=request.user,
            defaults={"rating": rating, "comment": (request.data.get("comment") or "")[:300]},
        )
        apply_feedback_learning(msg, rating)
        return Response({"status": "recorded", "rating": rating})


class KnowledgeDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = KnowledgeDocumentSerializer
    permission_classes = [has_role("admin", "provider")]
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    pagination_class = None

    def get_queryset(self):
        qs = KnowledgeDocument.objects.select_related("reviewed_by").all()
        status_filter = self.request.query_params.get("review_status")
        language = self.request.query_params.get("language")
        if status_filter:
            qs = qs.filter(review_status=status_filter)
        if language:
            qs = qs.filter(language=language)
        return qs

    def perform_create(self, serializer):
        with bounded_semaphore("ai:ingest", max_concurrent=4):
            doc = serializer.save()
            if doc.review_status == KnowledgeDocument.ReviewStatus.APPROVED:
                doc.reviewed_by = self.request.user
                doc.published_at = timezone.now()
                doc.save(update_fields=["reviewed_by", "published_at"])
                ingest_document(doc)
            log_audit(self.request, "ai.knowledge.create", "KnowledgeDocument", doc.id, {"title": doc.title})

    def perform_update(self, serializer):
        instance = self.get_object()
        with distributed_mutex(f"ai:doc:{instance.id}", ttl_seconds=20):
            with bounded_semaphore("ai:ingest", max_concurrent=4):
                with transaction.atomic():
                    doc = serializer.save()
                    if doc.review_status == KnowledgeDocument.ReviewStatus.APPROVED:
                        ingest_document(doc)
                    elif doc.review_status == KnowledgeDocument.ReviewStatus.ARCHIVED:
                        doc.chunks.all().delete()
                    log_audit(self.request, "ai.knowledge.update", "KnowledgeDocument", doc.id, {"title": doc.title})

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        doc = self.get_object()
        try:
            with distributed_mutex(f"ai:doc:{doc.id}", ttl_seconds=20):
                with bounded_semaphore("ai:ingest", max_concurrent=4):
                    with transaction.atomic():
                        locked = KnowledgeDocument.objects.select_for_update().get(pk=doc.pk)
                        locked.review_status = KnowledgeDocument.ReviewStatus.APPROVED
                        locked.reviewed_by = request.user
                        locked.published_at = timezone.now()
                        locked.save(update_fields=["review_status", "reviewed_by", "published_at", "updated_at"])
                        chunk_count = ingest_document(locked)
                        log_audit(request, "ai.knowledge.approve", "KnowledgeDocument", locked.id, {"title": locked.title, "chunks": chunk_count})
                        return Response(KnowledgeDocumentSerializer(locked).data)
        except ConcurrencyBusyError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)

    @action(detail=False, methods=["post"], url_path="upload")
    def upload(self, request):
        """Allow admins/educators to upload full PDF, DOCX, TXT, or MD medical documents into the RAG database."""
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        filename = (uploaded.name or "").lower()
        text = ""
        try:
            if filename.endswith(".pdf"):
                from pypdf import PdfReader
                reader = PdfReader(uploaded)
                pages = [(p.extract_text() or "").strip() for p in reader.pages]
                text = "\n\n".join(p for p in pages if p)
            elif filename.endswith(".docx"):
                import docx
                document = docx.Document(uploaded)
                parts = [p.text.strip() for p in document.paragraphs if p.text.strip()]
                for tbl in document.tables:
                    for row in tbl.rows:
                        row_txt = " | ".join(c.text.strip() for c in row.cells if c.text.strip())
                        if row_txt:
                            parts.append(row_txt)
                text = "\n\n".join(parts)
            else:
                text = uploaded.read().decode("utf-8", errors="ignore").strip()
        except Exception as exc:
            return Response({"error": f"Could not extract text from document: {exc}"}, status=status.HTTP_400_BAD_REQUEST)

        if not text:
            return Response({"error": "Uploaded document contains no readable text."}, status=status.HTTP_400_BAD_REQUEST)

        ext = filename.rsplit(".", 1)[-1] if "." in filename else "txt"
        title = request.data.get("title") or uploaded.name.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").title()
        source = request.data.get("source") or f"Uploaded {ext.upper()} Document"
        language = request.data.get("language") or "en"
        auto_approve = str(request.data.get("approve", "true")).lower() in ("true", "1", "yes")

        with bounded_semaphore("ai:ingest", max_concurrent=4):
            with transaction.atomic():
                doc = KnowledgeDocument.objects.create(
                    title=title,
                    source=source,
                    document_type=ext[:20],
                    language=language,
                    content=text,
                    review_status=KnowledgeDocument.ReviewStatus.APPROVED if auto_approve else KnowledgeDocument.ReviewStatus.DRAFT,
                    reviewed_by=request.user if auto_approve else None,
                    published_at=timezone.now() if auto_approve else None,
                )
                if auto_approve:
                    ingest_document(doc)
                log_audit(request, "ai.knowledge.upload", "KnowledgeDocument", doc.id, {"title": doc.title, "type": ext})
        return Response(KnowledgeDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


class LearningInsightViewSet(viewsets.ModelViewSet):
    """Self-improvement review queue for Health Educators & Admins."""

    serializer_class = LearningInsightSerializer
    permission_classes = [has_role("admin", "provider")]
    pagination_class = None

    def get_queryset(self):
        qs = LearningInsight.objects.all()
        status_f = self.request.query_params.get("status")
        if status_f:
            qs = qs.filter(status=status_f)
        return qs

    @action(detail=True, methods=["post"], url_path="promote")
    def promote(self, request, pk=None):
        """Promote a verified learned insight into an approved vector-indexed KnowledgeDocument."""
        insight = self.get_object()
        title = (request.data.get("title") or insight.question_pattern[:120]).strip()
        answer = (request.data.get("answer") or insight.suggested_answer).strip()
        if not answer:
            return Response({"error": "Provide a verified answer before promoting."}, status=status.HTTP_400_BAD_REQUEST)

        with bounded_semaphore("ai:ingest", max_concurrent=4):
            with transaction.atomic():
                doc = KnowledgeDocument.objects.create(
                    title=title,
                    source="Wekebeze Learned & Educator-Verified",
                    document_type="learned",
                    language=insight.language,
                    content=f"Question: {insight.question_pattern}\n\nVerified Guidance:\n{answer}",
                    review_status=KnowledgeDocument.ReviewStatus.APPROVED,
                    reviewed_by=request.user,
                    published_at=timezone.now(),
                )
                ingest_document(doc)
                insight.status = LearningInsight.Status.PROMOTED
                insight.suggested_answer = answer
                insight.save(update_fields=["status", "suggested_answer", "updated_at"])
                log_audit(request, "ai.insight.promote", "LearningInsight", insight.id, {"doc_id": str(doc.id)})
        return Response(KnowledgeDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="dismiss")
    def dismiss(self, request, pk=None):
        insight = self.get_object()
        insight.status = LearningInsight.Status.DISMISSED
        insight.save(update_fields=["status", "updated_at"])
        return Response(LearningInsightSerializer(insight).data)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def guest_ask_view(request):
    """Anonymous guest AI endpoint (no sign-up required; stateless, up to 4 turns of history)."""
    content = (request.data.get("content") or "").strip()
    language = request.data.get("language") or "en"
    raw_history = request.data.get("history") or []
    if not content:
        return Response({"error": "Message content is required."}, status=status.HTTP_400_BAD_REQUEST)
    if len(content) > 600:
        return Response({"error": "Guest message is too long (max 600 characters)."}, status=status.HTTP_400_BAD_REQUEST)

    safe_history = [
        {"role": h.get("role"), "content": str(h.get("content", ""))[:600]}
        for h in raw_history[-4:]
        if isinstance(h, dict) and h.get("role") in ("user", "assistant")
    ]

    try:
        with bounded_semaphore("ai:inference", max_concurrent=10, ttl_seconds=35):
            result = run_chat_graph(content, language=language, history=safe_history)
    except ConcurrencyBusyError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    return Response({
        "content": result.get("response", ""),
        "sources": result.get("sources", []),
        "metadata": {
            "language": result.get("language", language),
            "is_urgent": bool(result.get("is_urgent", False)),
            "recommended_centers": result.get("recommended_centers", []),
        },
    })
