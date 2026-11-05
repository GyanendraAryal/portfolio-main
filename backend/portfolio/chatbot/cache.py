"""
App-side response cache.

Keyed by: SHA-256( normalise(query) + ":" + active_version )
TTL: settings.RESPONSE_CACHE_TTL (default 3600 s)

Backend: in-process LRU dict with expiry timestamps.
Limitation: resets on every Gunicorn worker restart (cold start or deploy).
This is acceptable — the LLM call is the expensive part, and the cache
is purely a latency / quota optimisation, not a correctness requirement.

If you add multiple Gunicorn workers (WEB_CONCURRENCY > 1 on Render),
each worker has its own cache. For a free-tier single-worker deployment
this is fine.
"""

from __future__ import annotations

import hashlib
import time
from typing import Optional

from django.conf import settings

_store: dict[str, tuple[str, float]] = {}   # key → (answer, expires_at)
_MAX_ENTRIES = 256


def _cache_key(query: str, active_version: str) -> str:
    normalised = " ".join(query.lower().split())
    raw = f"{normalised}:{active_version}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _ttl() -> int:
    return getattr(settings, 'RESPONSE_CACHE_TTL', 3600)


def get_cached_answer(query: str, active_version: str) -> Optional[str]:
    """Return a cached answer or None if not found / expired."""
    key = _cache_key(query, active_version)
    entry = _store.get(key)
    if entry is None:
        return None
    answer, expires_at = entry
    if time.monotonic() > expires_at:
        del _store[key]
        return None
    return answer


def set_cached_answer(query: str, active_version: str, answer: str) -> None:
    """Store an answer in the cache, evicting the oldest entry if full."""
    if len(_store) >= _MAX_ENTRIES:
        # Evict the entry with the earliest expiry
        oldest_key = min(_store, key=lambda k: _store[k][1])
        del _store[oldest_key]
    key = _cache_key(query, active_version)
    _store[key] = (answer, time.monotonic() + _ttl())


def invalidate_version(active_version: str) -> int:
    """Remove all cache entries belonging to a specific resume version."""
    suffix = f":{active_version}"
    keys_to_delete = [
        k for k, _ in _store.items()
        # We stored the hash of (query+":"+version), so we can't reverse it.
        # Instead, tag each entry with metadata via a side dict.
    ]
    # Because the key is a hash we can't filter by version without a side index.
    # Simplest safe approach: clear the entire cache when the version changes.
    # At typical traffic volumes (single resume, infrequent updates) this is fine.
    count = len(_store)
    _store.clear()
    return count
