from django.urls import path
from .views import (
    ChatView,
    CronResumeIndexView,
    IndexStatusView,
    PortfolioImageListCreateView,
    PortfolioImageDetailView,
    ResumeListView,
    ResumeUploadView,
    ResumeDeleteView,
    resume_file,
    ContactCreateView,
    ContactListView,
)

urlpatterns = [
    path('images/', PortfolioImageListCreateView.as_view()),
    path('images/<int:pk>/', PortfolioImageDetailView.as_view()),
    path('resume/', ResumeListView.as_view()),
    path('resume/upload/', ResumeUploadView.as_view()),
    path('resume/files/<path:file_path>', resume_file, name='resume_file'),
    path('resume/<int:pk>/', ResumeDeleteView.as_view()),
    path('contact/', ContactCreateView.as_view()),
    path('contacts/', ContactListView.as_view()),
    # Chatbot
    path('chat/', ChatView.as_view(), name='chat'),
    path('cron/resume-index/', CronResumeIndexView.as_view(), name='cron_resume_index'),
    path('index-status/', IndexStatusView.as_view(), name='index_status'),
]
