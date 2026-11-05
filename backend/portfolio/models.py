import hashlib

from django.db import models
import cloudinary.uploader


class PortfolioImage(models.Model):
    CATEGORY_CHOICES = [
        ('hero', 'Hero'),
        ('work', 'Work'),
        ('about', 'About'),
        ('other', 'Other'),
    ]

    title = models.CharField(max_length=200)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    image_url = models.URLField(max_length=500)
    public_id = models.CharField(max_length=300, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.category})"

    def delete(self, *args, **kwargs):
        if self.public_id:
            try:
                cloudinary.uploader.destroy(self.public_id)
            except:
                pass  # Continue deletion even if Cloudinary fails
        super().delete(*args, **kwargs)


class Resume(models.Model):
    title = models.CharField(max_length=200, default='Resume')
    content = models.BinaryField()
    content_hash = models.CharField(max_length=64, blank=True, default='', db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    file_url = models.URLField(max_length=500)
    public_id = models.CharField(max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({'Active' if self.is_active else 'Inactive'})"

    def save(self, *args, **kwargs):
        if self.content:
            raw = bytes(self.content)
            self.content_hash = hashlib.sha256(raw).hexdigest()
        if self.is_active:
            Resume.objects.exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)


class ResumeIndexState(models.Model):
    """Single-row control table; always use pk=1."""

    STATUS_CHOICES = [
        ('idle', 'Idle'),
        ('indexing', 'Indexing'),
        ('failed', 'Failed'),
    ]

    active_version = models.CharField(max_length=64, blank=True, default='')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='idle')
    last_indexed_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True, default='')

    class Meta:
        verbose_name = 'Resume Index State'
        verbose_name_plural = 'Resume Index State'

    def __str__(self):
        return f"Index state: {self.status} (active={self.active_version[:12] or 'none'})"


class ResumeIndexJob(models.Model):
    """Outbox table for resume re-indexing jobs."""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('done', 'Done'),
        ('failed', 'Failed'),
    ]

    content_hash = models.CharField(max_length=64, db_index=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', db_index=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    last_error = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Resume Index Job'
        verbose_name_plural = 'Resume Index Jobs'

    def __str__(self):
        return f"Job {self.pk}: {self.status} ({self.content_hash[:12]})"

class Contact(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField()
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.email}"


class ChatRateEntry(models.Model):
    """Per-visitor rate-limit counters (Postgres-backed)."""

    visitor_hash = models.CharField(max_length=64, unique=True)
    daily_count = models.PositiveIntegerField(default=0)
    daily_window_start = models.DateTimeField()
    burst_count = models.PositiveIntegerField(default=0)
    burst_window_start = models.DateTimeField()

    class Meta:
        db_table = 'portfolio_chatrate'

    def __str__(self):
        return f"Rate({self.visitor_hash[:12]}) daily={self.daily_count}"