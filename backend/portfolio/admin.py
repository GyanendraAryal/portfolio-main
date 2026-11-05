from django.contrib import admin
from django import forms
from django.core.exceptions import ValidationError
from django.db import transaction
from django.urls import reverse
from django.utils.html import format_html

from .models import Contact, PortfolioImage, Resume, ResumeIndexJob, ResumeIndexState
from .validators import get_resume_file_error


def _enqueue_index_job(content_hash: str) -> None:
    """Insert a pending indexing job unless one already exists for this hash."""
    exists = ResumeIndexJob.objects.filter(
        content_hash=content_hash,
        status__in=('pending', 'running'),
    ).exists()
    if not exists:
        ResumeIndexJob.objects.create(content_hash=content_hash, status='pending')


@admin.register(PortfolioImage)
class PortfolioImageAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'created_at']
    list_filter = ['category', 'created_at']
    search_fields = ['title']
    ordering = ['-created_at']


class ResumeAdminForm(forms.ModelForm):
    resume_file = forms.FileField(
        required=False,
        label="PDF file",
        help_text="Upload a PDF to the database. Add a new resume to replace the active version.",
    )

    class Meta:
        model = Resume
        fields = ["title", "is_active", "resume_file"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance._state.adding:
            self.fields["resume_file"].required = True

    def clean_resume_file(self):
        uploaded_file = self.cleaned_data.get("resume_file")
        if uploaded_file is None:
            return None

        error = get_resume_file_error(uploaded_file)
        if error:
            raise ValidationError(error)
        return uploaded_file

    def clean(self):
        cleaned_data = super().clean()
        if self.errors:
            return cleaned_data

        uploaded_file = cleaned_data.get("resume_file")
        if uploaded_file is None:
            return cleaned_data

        return cleaned_data

    def save(self, commit=True):
        instance = super().save(commit=False)
        uploaded_file = self.cleaned_data.get("resume_file")
        if uploaded_file is not None:
            instance.content = uploaded_file.read()
            instance.public_id = ""
            instance.file_url = reverse(
                "resume_file",
                kwargs={"file_path": "resume.pdf"},
            )

        if commit:
            instance.save()
            self.save_m2m()
        return instance


@admin.register(Resume)
class ResumeAdmin(admin.ModelAdmin):
    form = ResumeAdminForm
    list_display = ['title', 'is_active', 'created_at', 'file_link']
    list_filter = ['is_active', 'created_at']
    search_fields = ['title']
    ordering = ['-created_at']
    readonly_fields = ['file_url', 'public_id', 'created_at', 'content_hash']
    fields = ['title', 'is_active', 'resume_file', 'file_url', 'public_id', 'created_at', 'content_hash']

    @admin.display(description="Resume file")
    def file_link(self, obj):
        return format_html('<a href="{}" target="_blank" rel="noopener">View PDF</a>', obj.file_url)

    def save_model(self, request, obj, form, change):
        if form.cleaned_data.get("resume_file") is not None:
            obj.file_url = request.build_absolute_uri(
                reverse("resume_file", kwargs={"file_path": "resume.pdf"})
            )
        with transaction.atomic():
            super().save_model(request, obj, form, change)
            # Belt-and-suspenders Python outbox insert; the Postgres trigger is the fallback.
            if obj.content_hash and obj.is_active:
                _enqueue_index_job(obj.content_hash)

    def get_fields(self, request, obj=None):
        fields = list(super().get_fields(request, obj))
        if obj is not None and "resume_file" in fields:
            fields.remove("resume_file")
        return fields

    def delete_queryset(self, _request, queryset):
        for resume in queryset.iterator():
            resume.delete()


@admin.register(ResumeIndexState)
class ResumeIndexStateAdmin(admin.ModelAdmin):
    list_display = ['status', 'active_version', 'last_indexed_at']
    readonly_fields = ['active_version', 'status', 'last_indexed_at', 'last_error']

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ResumeIndexJob)
class ResumeIndexJobAdmin(admin.ModelAdmin):
    list_display = ['id', 'status', 'content_hash', 'attempts', 'created_at']
    list_filter = ['status']
    readonly_fields = ['content_hash', 'status', 'attempts', 'created_at', 'last_error']
    ordering = ['-created_at']

    def has_add_permission(self, request):
        return False


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'email']
    readonly_fields = ['name', 'email', 'message', 'created_at']
    ordering = ['-created_at']
