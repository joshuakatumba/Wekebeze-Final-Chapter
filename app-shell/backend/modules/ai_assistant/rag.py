"""Document chunking, lightweight vector embedding, and approved-only RAG retrieval."""
import math
import re
from collections import Counter
from .models import KnowledgeChunk, KnowledgeDocument

STOPWORDS = {
    "the", "and", "for", "that", "this", "with", "from", "are", "was", "were",
    "have", "has", "had", "not", "but", "what", "when", "where", "how", "can",
    "you", "your", "about", "into", "their", "they", "will", "should", "could",
    "would", "there", "which", "more", "also", "been", "being", "some", "any",
}


def tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[a-zA-Z0-9']+", (text or "").lower())
    return [t for t in tokens if len(t) > 2 and t not in STOPWORDS]


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
    """Split document into chunks and store term-frequency metadata for fast retrieval."""
    document.chunks.all().delete()
    pieces = chunk_text(document.content)
    objs = []
    for idx, piece in enumerate(pieces):
        tokens = tokenize(piece)
        counts = dict(Counter(tokens).most_common(60))
        objs.append(
            KnowledgeChunk(
                document=document,
                content=piece,
                chunk_index=idx,
                embedding=[],
                metadata={
                    "title": document.title,
                    "source": document.source,
                    "language": document.language,
                    "terms": counts,
                },
            )
        )
    KnowledgeChunk.objects.bulk_create(objs)
    return len(objs)


def _cosine_dict(a: dict[str, int], b: dict[str, int]) -> float:
    if not a or not b:
        return 0.0
    common = set(a.keys()) & set(b.keys())
    if not common:
        return 0.0
    dot = sum(a[k] * b[k] for k in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def retrieve_approved_chunks(query: str, language: str = "en", top_k: int = 4) -> list[dict]:
    """Retrieve top-k chunks ONLY from approved KnowledgeDocuments."""
    q_terms = dict(Counter(tokenize(query)))
    qs = KnowledgeChunk.objects.select_related("document").filter(
        document__review_status=KnowledgeDocument.ReviewStatus.APPROVED
    )
    scored = []
    for chunk in qs:
        c_terms = (chunk.metadata or {}).get("terms") or dict(Counter(tokenize(chunk.content)))
        title_terms = dict(Counter(tokenize(chunk.document.title)))
        score = _cosine_dict(q_terms, c_terms) + 0.35 * _cosine_dict(q_terms, title_terms)
        if chunk.document.language == language:
            score += 0.08
        if score > 0.08:
            scored.append((score, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    results = []
    for score, chunk in scored[:top_k]:
        results.append({
            "chunk_id": str(chunk.id),
            "document_id": str(chunk.document_id),
            "title": chunk.document.title,
            "source": chunk.document.source,
            "language": chunk.document.language,
            "content": chunk.content,
            "score": round(score, 4),
        })
    return results

