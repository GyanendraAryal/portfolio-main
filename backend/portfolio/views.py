import hashlib
import json
import logging

from django.conf import settings
from django.db import transaction
from django.http import Http404, HttpResponse, StreamingHttpResponse
from django.urls import reverse
from django.views.decorators.http import require_GET
from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Contact, PortfolioImage, Resume, ResumeIndexJob, ResumeIndexState
from .permissions import IsAdminOrReadOnly
from .serializers import (
    ChatRequestSerializer,
    ContactReadSerializer,
    ContactSerializer,
    PortfolioImageSerializer,
    ResumeSerializer,
)
from .validators import get_resume_file_error

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _enqueue_index_job(content_hash: str) -> None:
    """Insert a pending indexing job unless one already exists for this hash."""
    exists = ResumeIndexJob.objects.filter(
        content_hash=content_hash,
        status__in=('pending', 'running'),
    ).exists()
    if not exists:
        ResumeIndexJob.objects.create(content_hash=content_hash, status='pending')


# ---------------------------------------------------------------------------
# Resume file download
# ---------------------------------------------------------------------------

@require_GET
def resume_file(request, file_path):
    resume = Resume.objects.order_by("-created_at").first()
    if resume is None or not resume.content:
        raise Http404("Resume file not found.")
    response = HttpResponse(bytes(resume.content), content_type="application/pdf")
    response["Content-Disposition"] = 'inline; filename="resume.pdf"'
    return response


# ---------------------------------------------------------------------------
# Portfolio images
# ---------------------------------------------------------------------------

class PortfolioImageListCreateView(generics.ListCreateAPIView):
    serializer_class = PortfolioImageSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAdminOrReadOnly]

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="category",
                type=str,
                location=OpenApiParameter.QUERY,
                enum=["hero", "work", "about", "other"],
                description="Filter images by category.",
            ),
        ],
        description="List portfolio images, optionally filtered by category.",
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(description="Upload an image to Cloudinary. Requires admin authentication.")
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)

    def get_queryset(self):
        qs = PortfolioImage.objects.all()
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs


class PortfolioImageDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = PortfolioImage.objects.all()
    serializer_class = PortfolioImageSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAdminOrReadOnly]

    @extend_schema(description="Retrieve a portfolio image.")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)

    @extend_schema(description="Update image title and/or category. Requires admin authentication.")
    def partial_update(self, request, *args, **kwargs):
        return super().partial_update(request, *args, **kwargs)

    @extend_schema(description="Delete the image record and its Cloudinary asset. Requires admin authentication.")
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)


# ---------------------------------------------------------------------------
# Resume
# ---------------------------------------------------------------------------

class ResumeListView(APIView):
    @extend_schema(
        responses=ResumeSerializer,
        description="Return the active resume, or null file URL and ID when none is active.",
    )
    def get(self, request):
        active = Resume.objects.filter(is_active=True).first()
        if not active:
            return Response({'file_url': None, 'id': None})
        return Response(ResumeSerializer(active).data)


class ResumeUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [IsAdminUser]

    @extend_schema(
        request=ResumeSerializer,
        responses={201: ResumeSerializer},
        description="Upload a PDF resume to the database and make it active. Requires admin authentication.",
    )
    def post(self, request):
        uploaded_file = request.FILES.get("file")
        if uploaded_file is None:
            return Response(
                {"file": "A PDF file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_error = get_resume_file_error(uploaded_file)
        if file_error:
            return Response({"file": file_error}, status=status.HTTP_400_BAD_REQUEST)

        title = request.data.get("title") or "Resume"
        if len(title) > Resume._meta.get_field("title").max_length:
            return Response(
                {"title": "Ensure this field has no more than 200 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_url = request.build_absolute_uri(
            reverse("resume_file", kwargs={"file_path": "resume.pdf"})
        )
        content = uploaded_file.read()

        with transaction.atomic():
            resume = Resume.objects.create(
                title=title,
                content=content,
                file_url=file_url,
                public_id="",
                is_active=True,
            )
            # Belt-and-suspenders: Python-side outbox insert in the same transaction.
            # The Postgres trigger on portfolio_resume is the fallback.
            if resume.content_hash and resume.is_active:
                _enqueue_index_job(resume.content_hash)

        return Response(
            ResumeSerializer(resume).data,
            status=status.HTTP_201_CREATED,
        )


class ResumeDeleteView(generics.DestroyAPIView):
    queryset = Resume.objects.all()
    serializer_class = ResumeSerializer
    permission_classes = [IsAdminUser]

    @extend_schema(description="Delete a resume and its stored file. Requires admin authentication.")
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)


# ---------------------------------------------------------------------------
# Contact
# ---------------------------------------------------------------------------

class ContactCreateView(generics.CreateAPIView):
    queryset = Contact.objects.all()
    serializer_class = ContactSerializer

    @extend_schema(description="Submit a contact message.")
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class ContactListView(generics.ListAPIView):
    queryset = Contact.objects.all()
    serializer_class = ContactReadSerializer
    permission_classes = [IsAdminUser]

    @extend_schema(description="List contact messages. Requires admin authentication.")
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


# ---------------------------------------------------------------------------
# Chatbot
# ---------------------------------------------------------------------------

class ChatView(APIView):
    """
    POST /api/chat/
    Body: { "message": "...", "session_id": "..." }

    Returns a chunked streaming response. Each chunk is a UTF-8 JSON line:
      data: {"token": "..."}\n
      data: {"done": true}\n
      data: {"error": "..."}\n   (on failure)

    The client reads via fetch + ReadableStream.
    """

    @extend_schema(
        request=ChatRequestSerializer,
        responses={200: None},
        description="Stream a chat response from the AI resume assistant.",
    )
    def post(self, request):
        from .chatbot.graph import get_graph
        from .chatbot.rate_limiter import RateLimiter

        serializer = ChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        message = serializer.validated_data['message']
        session_id = serializer.validated_data['session_id']

        # --- Rate limiting ---
        client_ip = (
            request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
            or request.META.get('REMOTE_ADDR', '')
        )
        ip_hash = hashlib.sha256(
            (client_ip + getattr(settings, 'VISITOR_HASH_SECRET', 'default-secret')).encode()
        ).hexdigest()

        limiter = RateLimiter()
        allowed, retry_after, remaining = limiter.check(ip_hash)
        if not allowed:
            response = Response(
                {"code": "rate_limited", "message": "Too many requests. Please try again later."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
            response['Retry-After'] = str(retry_after)
            response['X-RateLimit-Remaining'] = str(remaining)
            return response

        graph = get_graph()

        def token_stream():
            try:
                for chunk in graph.stream(
                    {"message": message, "session_id": session_id},
                    config={"configurable": {"thread_id": session_id}},
                    stream_mode="values",
                ):
                    token = chunk.get("streaming_token")
                    if token:
                        yield f'data: {json.dumps({"token": token})}\n\n'
                # Final message
                final_answer = chunk.get("answer", "")
                if final_answer and not chunk.get("streaming_token"):
                    # Non-streaming fallback: send full answer in one chunk
                    yield f'data: {json.dumps({"token": final_answer})}\n\n'
                yield f'data: {json.dumps({"done": True})}\n\n'
            except Exception as exc:
                logger.error("Chat stream error: %s", exc, exc_info=True)
                yield f'data: {json.dumps({"error": "Assistant is temporarily unavailable. Please try again."})}\n\n'

        response = StreamingHttpResponse(token_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        if remaining is not None:
            response['X-RateLimit-Remaining'] = str(remaining)
        return response


# ---------------------------------------------------------------------------
# Cron endpoint (protected by CRON_SECRET)
# ---------------------------------------------------------------------------

class CronResumeIndexView(APIView):
    """
    POST /api/cron/resume-index/
    Called by an external cron (e.g. cron-job.org) every minute.
    Protected by Authorization: Bearer <CRON_SECRET>.
    """

    def post(self, request):
        cron_secret = getattr(settings, 'CRON_SECRET', None)
        if not cron_secret:
            return Response(
                {"error": "CRON_SECRET not configured."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        auth_header = request.headers.get('Authorization', '')
        if auth_header != f'Bearer {cron_secret}':
            return Response({"error": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        from django.core.management import call_command
        try:
            call_command('index_resume')
        except Exception as exc:
            logger.error("Cron index_resume error: %s", exc, exc_info=True)
            return Response({"status": "error", "detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"status": "ok"})


# ---------------------------------------------------------------------------
# Index status (admin endpoint)
# ---------------------------------------------------------------------------

class IndexStatusView(APIView):
    permission_classes = [IsAdminUser]

    @extend_schema(
        description="Return current resume index state and pending/failed job counts.",
    )
    def get(self, request):
        state = ResumeIndexState.objects.filter(pk=1).first()
        pending = ResumeIndexJob.objects.filter(status='pending').count()
        failed = ResumeIndexJob.objects.filter(status='failed').count()
        return Response({
            "active_version": state.active_version if state else None,
            "status": state.status if state else "unknown",
            "last_indexed_at": state.last_indexed_at if state else None,
            "last_error": state.last_error if state else "",
            "pending_jobs": pending,
            "failed_jobs": failed,
        })
