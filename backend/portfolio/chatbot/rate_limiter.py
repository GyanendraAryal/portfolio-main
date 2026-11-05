"""
Per-visitor rate limiter backed by Postgres.

Identifies visitors by: SHA-256(raw_ip + VISITOR_HASH_SECRET)
  — raw IPs are never stored or logged.

Limits (configurable via env):
  CHAT_RATE_LIMIT_DAILY  — max messages per visitor per rolling 24-hour window (default 15)
  CHAT_RATE_LIMIT_BURST  — max messages per visitor per rolling 60-second window (default 5)

Returns (allowed: bool, retry_after_seconds: int, remaining: int | None).

Storage: portfolio_chatrate Postgres table (created via migration 0008).
Using Postgres means counters survive Gunicorn restarts and work correctly
across multiple workers.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Optional, Tuple

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class RateLimiter:
    def __init__(self):
        self.daily_limit: int = getattr(settings, 'CHAT_RATE_LIMIT_DAILY', 15)
        self.burst_limit: int = getattr(settings, 'CHAT_RATE_LIMIT_BURST', 5)

    def check(self, visitor_hash: str) -> Tuple[bool, int, Optional[int]]:
        """
        Check and consume one request token for the visitor.
        Returns (allowed, retry_after_seconds, remaining_daily).
        """
        from portfolio.models import ChatRateEntry
        from django.db import transaction

        now = timezone.now()
        daily_start = now - timedelta(hours=24)
        burst_start = now - timedelta(seconds=60)

        with transaction.atomic():
            entry, _ = ChatRateEntry.objects.select_for_update().get_or_create(
                visitor_hash=visitor_hash,
                defaults={
                    'daily_count': 0,
                    'daily_window_start': now,
                    'burst_count': 0,
                    'burst_window_start': now,
                },
            )

            # Reset windows if expired
            if entry.daily_window_start < daily_start:
                entry.daily_count = 0
                entry.daily_window_start = now

            if entry.burst_window_start < burst_start:
                entry.burst_count = 0
                entry.burst_window_start = now

            # Check limits
            if entry.daily_count >= self.daily_limit:
                retry_after = int(
                    (entry.daily_window_start + timedelta(hours=24) - now).total_seconds()
                )
                entry.save()
                return False, max(retry_after, 1), 0

            if entry.burst_count >= self.burst_limit:
                retry_after = int(
                    (entry.burst_window_start + timedelta(seconds=60) - now).total_seconds()
                )
                entry.save()
                return False, max(retry_after, 1), self.daily_limit - entry.daily_count

            # Consume
            entry.daily_count += 1
            entry.burst_count += 1
            entry.save()

        remaining = self.daily_limit - entry.daily_count
        return True, 0, remaining
