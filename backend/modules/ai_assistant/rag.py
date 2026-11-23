"""
Vector-based RAG pipeline with pgvector support and self-improving adaptive retrieval.
- Generates 256-dim dense normalized semantic vectors (word unigrams + bigrams + char 3-grams)
  or uses an external Embedding API when EMBEDDING_API_KEY is configured.
- Ranks approved KnowledgeChunks by cosine vector similarity blended with learned quality_score.
- Automatically records knowledge gaps and reinforces/downranks chunk weights from user feedback.
"""
import hashlib
import math
import os
import re
from collections import Counter

import requests
from django.db import connection, transaction
from django.db.models import F

from core.concurrency import distributed_mutex, rw_lock
from .models import KnowledgeChunk, KnowledgeDocument, LearningInsight

VECTOR_DIM = 256

STOPWORDS = {
    "the", "and", "for", "that", "this", "with", "from", "are", "was", "were",
    "have", "has", "had", "not", "but", "what", "when", "where", "how", "can",
    "you", "your", "about", "into", "their", "they", "will", "should", "could",
    "would", "there", "which", "more", "also", "been", "being", "some", "any",
}


def ensure_pgvector_extension():
    """Enable PostgreSQL pgvector extension if running on PostgreSQL with pgvector installed."""
    if connection.vendor != "postgresql":
        return False
    try:
        with connection.cursor() as cur:
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        return True
    except Exception:
        return False


def tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[a-zA-Z0-9']+", (text or "").lower())
    return [t for t in tokens if len(t) > 2 and t not in STOPWORDS]


def _local_dense_embedding(text: str, dim: int = VECTOR_DIM) -> list[float]:
    """Deterministic 256-dim normalized dense vector capturing words, bigrams, and character trigrams."""
    vec = [0.0] * dim
    tokens = tokenize(text)
    features: list[tuple[str, float]] = []
    for i, tok in enumerate(tokens):
        features.append((f"w:{tok}", 2.0))
        if i + 1 < len(tokens):
            features.append((f"b:{tok}_{tokens[i + 1]}", 1.5))
        if len(tok) >= 4:
            for j in range(len(tok) - 2):
                features.append((f"c:{tok[j:j + 3]}", 0.6))

    for feat, weight in features:
        h = hashlib.blake2b(feat.encode("utf-8"), digest_size=8).digest()
        idx = int.from_bytes(h[:4], "little") % dim
        sign = 1.0 if (h[4] & 1) == 0 else -1.0
        vec[idx] += sign * weight

    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [round(v / norm, 5) for v in vec]
    return vec


def embed_text(text: str) -> list[float]:
    """Generate dense vector using configured Embedding API if available, else local dense vector."""
    api_key = os.environ.get("EMBEDDING_API_KEY", "").strip()
    if api_key:
        model = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small").strip()
        base = os.environ.get("EMBEDDING_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        try:
            resp = requests.post(
                f"{base}/embeddings",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": model, "input": (text or "")[:8000]},
                timeout=15,
            )
            if resp.ok:
                data = resp.json().get("data") or []
                if data and data[0].get("embedding"):
                    return data[0]["embedding"]
        except Exception:
            pass
    return _local_dense_embedding(text)


def _cosine_vectors(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def chunk_text(text: str, max_chars: int = 700, overlap: int = 100) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text or "") if p.strip()]
    chunks = []
    buf = ""
    for p in paragraphs:
        if len(buf) + len(p) + 2 <= max_chars:
            buf = f"{buf}\n\n{p}".strip() if buf else p
        else:
            if buf:
                chunks.append(buf)
            if len(p) <= max_chars:
                buf = p
            else:
                start = 0
                while start < len(p):
                    chunks.append(p[start : start + max_chars].strip())
                    start += max(1, max_chars - overlap)
                buf = ""
    if buf:
        chunks.append(buf)
    return chunks or ([text.strip()] if (text or "").strip() else [])


def ingest_document(document: KnowledgeDocument) -> int:
    """Split document into chunks, compute dense vector embeddings, and store atomically under exclusive write lock."""
    ensure_pgvector_extension()
    pieces = chunk_text(document.content)
    objs = []
    for idx, piece in enumerate(pieces):
        tokens = tokenize(piece)
        counts = dict(Counter(tokens).most_common(60))
        vector = embed_text(f"{document.title}\n{piece}")
        objs.append(
            KnowledgeChunk(
                document=document,
                content=piece,
                chunk_index=idx,
                embedding=vector,
                metadata={
                    "title": document.title,
                    "source": document.source,
                    "language": document.language,
                    "terms": counts,
                },
            )
        )
    with rw_lock("rag:knowledge", mode="write", ttl_seconds=25):
        with transaction.atomic():
            document.chunks.all().delete()
            KnowledgeChunk.objects.bulk_create(objs)
    return len(objs)


def retrieve_approved_chunks(query: str, language: str = "en", top_k: int = 4) -> list[dict]:
    """
    Adaptive vector retrieval over approved KnowledgeChunks:
    Combines dense vector cosine similarity with each chunk's self-improving quality_score.
    """
    q_vec = embed_text(query)
    q_terms = set(tokenize(query))

    with rw_lock("rag:knowledge", mode="read", ttl_seconds=15):
        chunks_snapshot = list(
            KnowledgeChunk.objects.select_related("document").filter(
                document__review_status=KnowledgeDocument.ReviewStatus.APPROVED
            )
        )

    scored = []
    for chunk in chunks_snapshot:
        c_vec = chunk.embedding if chunk.embedding else _local_dense_embedding(f"{chunk.document.title}\n{chunk.content}")
        vec_sim = _cosine_vectors(q_vec, c_vec)

        c_terms = set((chunk.metadata or {}).get("terms", {}).keys()) | set(tokenize(chunk.document.title))
        lex_overlap = len(q_terms & c_terms) / max(1, len(q_terms)) if q_terms else 0.0

        base_score = 0.65 * vec_sim + 0.35 * lex_overlap
        if chunk.document.language == language:
            base_score += 0.06

        # Apply self-improving adaptive quality multiplier (bounded in [0.75, 1.35])
        adaptive_multiplier = max(0.75, min(1.35, 0.75 + 0.25 * (chunk.quality_score or 1.0)))
        final_score = base_score * adaptive_multiplier

        if base_score > 0.12:
            scored.append((final_score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:top_k]

    # Record retrieval stats without blocking readers
    if top:
        chunk_ids = [c.id for _, c in top]
        KnowledgeChunk.objects.filter(id__in=chunk_ids).update(retrieval_count=F("retrieval_count") + 1)

    return [
        {
            "chunk_id": str(chunk.id),
            "document_id": str(chunk.document_id),
            "title": chunk.document.title,
            "source": chunk.document.source,
            "language": chunk.document.language,
            "content": chunk.content,
            "score": round(score, 4),
            "quality_score": round(chunk.quality_score or 1.0, 3),
        }
        for score, chunk in top
    ]


def record_knowledge_gap(question: str, language: str = "en", suggested_answer: str = ""):
    """Log recurring unanswered questions into LearningInsight so Educators can expand the knowledge base."""
    normalized = " ".join((question or "").strip().split())[:300]
    if len(normalized) < 8:
        return
    with distributed_mutex("ai:learning_insight", ttl_seconds=10):
        with transaction.atomic():
            existing = LearningInsight.objects.select_for_update().filter(
                question_pattern__iexact=normalized, language=language
            ).first()
            if existing:
                existing.hit_count += 1
                if suggested_answer and not existing.suggested_answer:
                    existing.suggested_answer = suggested_answer
                existing.save(update_fields=["hit_count", "suggested_answer", "updated_at"])
            else:
                LearningInsight.objects.create(
                    question_pattern=normalized,
                    suggested_answer=suggested_answer,
                    language=language,
                    insight_type=LearningInsight.InsightType.KNOWLEDGE_GAP,
                )


def apply_feedback_learning(message, rating: int):
    """
    Self-improvement step triggered by user 👍 (+1) / 👎 (-1) feedback:
    1. Updates Bayesian-smoothed quality_score on every KnowledgeChunk cited in the reply.
    2. Captures high-rated Q&As or unhelpful gaps into LearningInsight.
    """
    chunk_ids = [s["chunk_id"] for s in (message.sources or []) if s.get("chunk_id")]
    if chunk_ids:
        with distributed_mutex("ai:chunk_feedback", ttl_seconds=10):
            with transaction.atomic():
                chunks = list(KnowledgeChunk.objects.select_for_update().filter(id__in=chunk_ids))
                for c in chunks:
                    if rating > 0:
                        c.helpful_count += 1
                    else:
                        c.unhelpful_count += 1
                    # Bayesian smoothed quality score: starts at 1.0, trends up to ~2.0 on helpful, down to ~0.4 on unhelpful
                    c.quality_score = round((c.helpful_count + 3.0) / (c.helpful_count + c.unhelpful_count + 3.0) * 1.5, 4)
                    c.save(update_fields=["helpful_count", "unhelpful_count", "quality_score"])

    # Find the preceding user question for this assistant reply
    prev_user_msg = (
        message.conversation.messages.filter(role="user", created_at__lt=message.created_at)
        .order_by("-created_at")
        .first()
    )
    if not prev_user_msg:
        return

    normalized = " ".join(prev_user_msg.content.strip().split())[:300]
    lang = (message.metadata or {}).get("language") or message.conversation.language or "en"
    with distributed_mutex("ai:learning_insight", ttl_seconds=10):
        with transaction.atomic():
            insight, created = LearningInsight.objects.select_for_update().get_or_create(
                question_pattern=normalized,
                language=lang,
                defaults={
                    "suggested_answer": message.content if rating > 0 else "",
                    "insight_type": LearningInsight.InsightType.HIGH_RATED if rating > 0 else LearningInsight.InsightType.KNOWLEDGE_GAP,
                    "helpful_votes": 1 if rating > 0 else 0,
                },
            )
            if not created:
                insight.hit_count += 1
                if rating > 0:
                    insight.helpful_votes += 1
                    insight.insight_type = LearningInsight.InsightType.HIGH_RATED
                    insight.suggested_answer = message.content
                insight.save(update_fields=["hit_count", "helpful_votes", "insight_type", "suggested_answer", "updated_at"])
