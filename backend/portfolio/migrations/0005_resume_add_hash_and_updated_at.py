from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("portfolio", "0004_resume_content_binary"),
    ]

    operations = [
        migrations.AddField(
            model_name="resume",
            name="content_hash",
            field=models.CharField(blank=True, db_index=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="resume",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
    ]
