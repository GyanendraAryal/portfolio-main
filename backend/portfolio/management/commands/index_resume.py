"""
Management command: index_resume

Claims the oldest pending ResumeIndexJob, embeds the resume chunks, and
upserts them into Qdrant. Uses SELECT FOR UPDATE SKIP LOCKED so concurrent
cron runs never process the same job.

Usage:
  python manage.py index_resume          # process one pending job (normal cron use)
  python manage.py index_resume --all    # process all pending jobs (recovery)
"""

from __future__ import annotations

import logging

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5


class Command(BaseCommand):
    help = "Process pending resume index jobs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--all",
            action="store_true",
            help="Process all pending jobs, not just the oldest one.",
        )

    def handle(self, *args, **options):
        from portfolio.models import Resume, ResumeIndexJob, ResumeIndexState
        from portfolio.chatbot.cache import invalidate_version
        from portfolio.chatbot.chunker import chunk_resume
        from portfolio.chatbot.embedder import embed_texts
        from portfolio.chatbot.qdrant_store import (
            delete_old_version_points,
            ensure_collection,
            upsert_chunks,
        )

        process_all = options.get("all", False)
        processed = 0

        while True:
            # ── Claim one pending job ────────────────────────────────────────
            with transaction.atomic():
                job = (
                    ResumeIndexJob.objects.select_for_update(skip_locked=True)
                    .filter(status="pending")
                    .order_by("created_at")
                    .first()
                )

                if job is None:
                    if processed == 0:
                        self.stdout.write("No pending jobs.")
                    break

                job.status = "running"
                job.save(update_fields=["status"])

            self.stdout.write(f"Processing job {job.pk} (hash={job.content_hash[:12]}…)")

            try:
                # ── Idempotency check ────────────────────────────────────────
                state = ResumeIndexState.objects.filter(pk=1).first()
                if state and state.active_version == job.content_hash:
                    self.stdout.write("  Already active — marking done.")
                    job.status = "done"
                    job.save(update_fields=["status"])
                    processed += 1
                    if not process_all:
                        break
                    continue

                # ── Load resume ──────────────────────────────────────────────
                resume = Resume.objects.filter(content_hash=job.content_hash, is_active=True).first()
                if resume is None:
                    # The active resume may have changed; check any resume with this hash
                    resume = Resume.objects.filter(content_hash=job.content_hash).first()
                if resume is None:
                    raise ValueError(f"No resume found for hash {job.content_hash[:12]}")

                pdf_bytes = bytes(resume.content)

                # ── Chunk + embed ────────────────────────────────────────────
                self.stdout.write("  Chunking…")
                chunks = chunk_resume(pdf_bytes, job.content_hash)
                if not chunks:
                    raise ValueError("Chunker produced zero chunks — check PDF content.")
                self.stdout.write(f"  {len(chunks)} chunks")

                self.stdout.write("  Embedding…")
                texts = [c.text for c in chunks]
                vectors = embed_texts(texts)

                # ── Upsert into Qdrant ───────────────────────────────────────
                self.stdout.write("  Upserting into Qdrant…")
                ensure_collection()
                upsert_chunks(chunks, vectors)

                # ── Atomically update state + mark job done ──────────────────
                old_version = state.active_version if state else ""

                with transaction.atomic():
                    state_obj, _ = ResumeIndexState.objects.select_for_update().get_or_create(
                        pk=1,
                        defaults={
                            "active_version": "",
                            "status": "idle",
                        },
                    )
                    state_obj.active_version = job.content_hash
                    state_obj.status = "idle"
                    state_obj.last_indexed_at = timezone.now()
                    state_obj.last_error = ""
                    state_obj.save()

                    job.status = "done"
                    job.save(update_fields=["status"])

                # ── Clean up old Qdrant points + invalidate cache ────────────
                if old_version and old_version != job.content_hash:
                    self.stdout.write("  Deleting old Qdrant points…")
                    try:
                        delete_old_version_points(job.content_hash)
                    except Exception as exc:
                        logger.warning("Could not delete old Qdrant points: %s", exc)

                    invalidate_version(old_version)

                self.stdout.write(self.style.SUCCESS(f"  Job {job.pk} done — active={job.content_hash[:12]}"))
                processed += 1

            except Exception as exc:
                logger.error("index_resume job %d failed: %s", job.pk, exc, exc_info=True)
                self.stderr.write(f"  Error: {exc}")

                job.attempts += 1
                job.last_error = str(exc)

                if job.attempts >= MAX_ATTEMPTS:
                    job.status = "failed"
                    # Mark index state as failed
                    try:
                        with transaction.atomic():
                            state_obj, _ = ResumeIndexState.objects.select_for_update().get_or_create(
                                pk=1,
                                defaults={"active_version": "", "status": "failed"},
                            )
                            state_obj.status = "failed"
                            state_obj.last_error = str(exc)
                            state_obj.save()
                    except Exception:
                        pass
                else:
                    job.status = "pending"  # retry next cron run

                job.save(update_fields=["status", "attempts", "last_error"])

            if not process_all:
                break

        if processed:
            self.stdout.write(f"Processed {processed} job(s).")
