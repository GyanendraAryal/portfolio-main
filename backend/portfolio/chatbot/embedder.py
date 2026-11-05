"""
Embedding wrapper — uses the Hugging Face Inference API with
sentence-transformers/all-MiniLM-L6-v2 (384 dimensions, free tier).

Tradeoffs:
  - Free tier: rate-limited to ~30k chars/month on the free Inference API.
    For a single resume this is more than enough; bulk re-indexing should
    use the dedicated InferenceClient feature_extraction endpoint.
  - App-side embedding cache: keyed by SHA-256 of the normalised query text.
    Hits are served from an in-process dict; the cache resets on Gunicorn
    worker restart (acceptable — embeddings are cheap to recompute).
  - No persistent cache store is needed because the free tier quota is not
    exhausted by typical chatbot traffic.

Vector size: 384  (all-MiniLM-L6-v2)
Distance:    Cosine
"""

from __future__ import annotations

import hashlib
import logging
from functools import lru_cache

from django.conf import settings

logger = logging.getLogger(__name__)

HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
VECTOR_SIZE = 384

# In-process LRU embedding cache (query text → embedding vector).
# 512 entries ≈ 512 * 384 * 4 bytes ≈ ~800 KB — negligible.
_embedding_cache: dict[str, list[float]] = {}
_CACHE_MAX = 512


def _cache_key(text: str) -> str:
    normalised = " ".join(text.lower().split())
    return hashlib.sha256(normalised.encode()).hexdigest()


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embed a list of texts and return a list of float vectors.
    Checks the in-process cache before calling the HF API.
    """
    from huggingface_hub import InferenceClient

    api_token = getattr(settings, 'HF_API_TOKEN', '')
    client = InferenceClient(token=api_token if api_token else None)

    results: list[list[float]] = []
    uncached_indices: list[int] = []
    uncached_texts: list[str] = []

    for i, text in enumerate(texts):
        key = _cache_key(text)
        if key in _embedding_cache:
            results.append(_embedding_cache[key])
        else:
            results.append([])  # placeholder
            uncached_indices.append(i)
            uncached_texts.append(text)

    if uncached_texts:
        try:
            raw = client.feature_extraction(uncached_texts, model=HF_MODEL)
            # raw is a list of lists (one vector per input)
            vectors = _normalise_hf_output(raw)
            for idx, vec in zip(uncached_indices, vectors):
                key = _cache_key(texts[idx])
                if len(_embedding_cache) < _CACHE_MAX:
                    _embedding_cache[key] = vec
                results[idx] = vec
        except Exception as exc:
            logger.error("HF embedding error: %s", exc, exc_info=True)
            raise

    return results


def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    return embed_texts([text])[0]


def _normalise_hf_output(raw) -> list[list[float]]:
    """
    The HF InferenceClient may return nested lists or numpy arrays.
    Normalise to list[list[float]].
    """
    # If it's a single vector (1-D), wrap it
    if raw and not isinstance(raw[0], (list, tuple)) and not hasattr(raw[0], '__iter__'):
        return [list(raw)]

    result = []
    for item in raw:
        # item may be a list of lists (mean-pooled) or a plain list
        if item and isinstance(item[0], (list, tuple)):
            # Take the first token or mean manually — use item[0] as fallback
            result.append([float(v) for v in item[0]])
        else:
            result.append([float(v) for v in item])
    return result
