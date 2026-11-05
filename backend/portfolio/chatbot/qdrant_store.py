"""
Qdrant Cloud helpers — upsert, query, delete.

Collection spec:
  name:       settings.QDRANT_COLLECTION  (default: "resume_chunks")
  vector size: 384  (all-MiniLM-L6-v2)
  distance:   Cosine

Point ID scheme: integer derived from SHA-256 of
  "{resume_version}:{section}:{index}"
  → ensures deterministic IDs so re-indexing is idempotent.

Each point payload:
  {
    "resume_version": "<sha256 hex>",
    "section":        "<section name>",
    "text":           "<chunk text>",
  }
"""

from __future__ import annotations

import hashlib
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.30   # below this → treat as "not in resume"
TOP_K = 5


def _get_client():
    from qdrant_client import QdrantClient
    return QdrantClient(
        url=getattr(settings, 'QDRANT_URL', ''),
        api_key=getattr(settings, 'QDRANT_API_KEY', ''),
    )


def _collection_name() -> str:
    return getattr(settings, 'QDRANT_COLLECTION', 'resume_chunks')


def _point_id(resume_version: str, section: str, index: int) -> int:
    """Stable integer ID derived from the chunk's logical position."""
    raw = f"{resume_version}:{section}:{index}"
    digest = hashlib.sha256(raw.encode()).hexdigest()
    # Use lower 63 bits to stay within signed int64
    return int(digest[:15], 16)


def ensure_collection() -> None:
    """Create the Qdrant collection if it does not already exist."""
    from qdrant_client.models import Distance, VectorParams
    from .embedder import VECTOR_SIZE

    client = _get_client()
    name = _collection_name()
    existing = {c.name for c in client.get_collections().collections}
    if name not in existing:
        client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        logger.info("Created Qdrant collection '%s'", name)


def upsert_chunks(chunks, vectors: list[list[float]]) -> None:
    """
    Upsert a list of ResumeChunks and their pre-computed vectors into Qdrant.
    Idempotent — existing points with the same ID are overwritten.
    """
    from qdrant_client.models import PointStruct

    client = _get_client()
    name = _collection_name()

    points = []
    for chunk, vector in zip(chunks, vectors):
        point_id = _point_id(
            chunk.metadata['resume_version'],
            chunk.section,
            chunk.index,
        )
        points.append(PointStruct(
            id=point_id,
            vector=vector,
            payload={
                "resume_version": chunk.metadata['resume_version'],
                "section": chunk.section,
                "text": chunk.text,
            },
        ))

    if points:
        client.upsert(collection_name=name, points=points)
        logger.info("Upserted %d points into '%s'", len(points), name)


def query_chunks(
    query_vector: list[float],
    active_version: str,
    top_k: int = TOP_K,
) -> list[dict]:
    """
    Search the collection for the top-k chunks matching `query_vector`,
    filtered to `active_version` only.

    Returns a list of dicts: [{"text": ..., "section": ..., "score": ...}]
    Results below SIMILARITY_THRESHOLD are excluded.
    """
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    client = _get_client()
    name = _collection_name()

    version_filter = Filter(
        must=[FieldCondition(key="resume_version", match=MatchValue(value=active_version))]
    )

    results = client.search(
        collection_name=name,
        query_vector=query_vector,
        limit=top_k,
        query_filter=version_filter,
        with_payload=True,
        score_threshold=SIMILARITY_THRESHOLD,
    )

    return [
        {
            "text": hit.payload.get("text", ""),
            "section": hit.payload.get("section", ""),
            "score": hit.score,
        }
        for hit in results
    ]


def delete_old_version_points(active_version: str) -> None:
    """
    Delete all points whose resume_version does NOT equal active_version.
    Called after a successful index switch to clean up stale vectors.
    """
    from qdrant_client.models import Filter, FieldCondition, MatchExcept

    client = _get_client()
    name = _collection_name()

    old_filter = Filter(
        must_not=[
            FieldCondition(key="resume_version", match=MatchValue(value=active_version))
        ]
    )
    client.delete(collection_name=name, points_selector=old_filter)
    logger.info("Deleted old-version points from '%s' (keeping %s)", name, active_version[:12])
