#!/usr/bin/env python
"""
Full re-index script — processes ALL pending jobs (or creates one if none exist).

Use this for:
  - Initial load after first resume upload
  - Manual recovery after index failures

Usage (from the backend/ directory with venv active):
  python ../scripts/ingest.py

Or via Django management command directly:
  python manage.py index_resume --all
"""

import os
import sys
import django

# Allow running from the repo root or scripts/ directory
BACKEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, os.path.abspath(BACKEND_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.management import call_command
from portfolio.models import Resume, ResumeIndexJob


def main():
    # If there are no pending jobs, create one from the active resume
    active = Resume.objects.filter(is_active=True).first()
    if active and active.content_hash:
        pending = ResumeIndexJob.objects.filter(
            content_hash=active.content_hash,
            status__in=('pending', 'running'),
        ).exists()
        if not pending:
            ResumeIndexJob.objects.create(
                content_hash=active.content_hash,
                status='pending',
            )
            print(f"Created pending job for hash {active.content_hash[:12]}…")
    elif active and not active.content_hash:
        print("WARNING: Active resume has no content_hash. Re-save it to compute the hash.")
        sys.exit(1)
    else:
        print("No active resume found. Upload one via the admin or API first.")
        sys.exit(1)

    call_command('index_resume', all=True)


if __name__ == '__main__':
    main()
