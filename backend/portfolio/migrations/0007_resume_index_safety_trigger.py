from django.db import migrations

# ---------------------------------------------------------------------------
# Postgres safety-net trigger
#
# Fires AFTER INSERT OR UPDATE OF content, is_active ON portfolio_resume.
# If the new row is active and has a non-empty content_hash, it inserts a
# 'pending' row into portfolio_resumeindexjob — but ONLY when no pending or
# running job for that hash already exists.
#
# Safety guarantees:
#   * Pure DML — no HTTP calls, no pg_net, no PERFORM, no external functions.
#   * Idempotent — the NOT EXISTS guard prevents duplicate jobs.
#   * Atomic — runs inside the same transaction as the triggering statement.
# ---------------------------------------------------------------------------

FORWARD_SQL = """
CREATE OR REPLACE FUNCTION resume_outbox_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only act when the resume is active and has a hash
    IF NEW.is_active AND NEW.content_hash <> '' THEN
        INSERT INTO portfolio_resumeindexjob (content_hash, status, attempts, last_error, created_at)
        SELECT NEW.content_hash, 'pending', 0, '', NOW()
        WHERE NOT EXISTS (
            SELECT 1
            FROM portfolio_resumeindexjob
            WHERE content_hash = NEW.content_hash
              AND status IN ('pending', 'running')
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER resume_outbox_trigger
AFTER INSERT OR UPDATE OF content, is_active
ON portfolio_resume
FOR EACH ROW
EXECUTE FUNCTION resume_outbox_trigger_fn();
"""

REVERSE_SQL = """
DROP TRIGGER IF EXISTS resume_outbox_trigger ON portfolio_resume;
DROP FUNCTION IF EXISTS resume_outbox_trigger_fn;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("portfolio", "0006_resumeindexstate_resumeindexjob"),
    ]

    operations = [
        migrations.RunSQL(sql=FORWARD_SQL, reverse_sql=REVERSE_SQL),
    ]
