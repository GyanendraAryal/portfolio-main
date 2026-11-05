from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("portfolio", "0005_resume_add_hash_and_updated_at"),
    ]

    operations = [
        migrations.CreateModel(
            name="ResumeIndexState",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("active_version", models.CharField(blank=True, default="", max_length=64)),
                (
                    "status",
                    models.CharField(
                        choices=[("idle", "Idle"), ("indexing", "Indexing"), ("failed", "Failed")],
                        default="idle",
                        max_length=10,
                    ),
                ),
                ("last_indexed_at", models.DateTimeField(blank=True, null=True)),
                ("last_error", models.TextField(blank=True, default="")),
            ],
            options={
                "verbose_name": "Resume Index State",
                "verbose_name_plural": "Resume Index State",
            },
        ),
        migrations.CreateModel(
            name="ResumeIndexJob",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("content_hash", models.CharField(db_index=True, max_length=64)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("running", "Running"),
                            ("done", "Done"),
                            ("failed", "Failed"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=10,
                    ),
                ),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("last_error", models.TextField(blank=True, default="")),
            ],
            options={
                "verbose_name": "Resume Index Job",
                "verbose_name_plural": "Resume Index Jobs",
                "ordering": ["created_at"],
            },
        ),
    ]
