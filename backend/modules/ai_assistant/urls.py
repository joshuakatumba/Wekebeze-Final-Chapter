from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ConversationViewSet, KnowledgeDocumentViewSet, LearningInsightViewSet, guest_ask_view

router = DefaultRouter()
router.register("conversations", ConversationViewSet, basename="ai-conversation")
router.register("knowledge", KnowledgeDocumentViewSet, basename="ai-knowledge")
router.register("insights", LearningInsightViewSet, basename="ai-insight")

urlpatterns = [
    path("guest/ask/", guest_ask_view, name="ai-guest-ask"),
    path("", include(router.urls)),
]
