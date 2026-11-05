from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("portfolio", "0007_resume_index_safety_trigger"),
    ]

    operations = [
        migrations.CreateModel(
            name="ChatRateEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("visitor_hash", models.CharField(max_length=64, unique=True)),
                ("daily_count", models.PositiveIntegerField(default=0)),
                ("daily_window_start", models.DateTimeField()),
                ("burst_count", models.PositiveIntegerField(default=0)),
                ("burst_window_start", models.DateTimeField()),
            ],
            options={
                "db_table": "portfolio_chatrate",
            },
        ),
    ]
