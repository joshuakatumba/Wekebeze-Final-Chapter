from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ConversationViewSet, KnowledgeDocumentViewSet

router = DefaultRouter()
router.register("conversations", ConversationViewSet, basename="ai-conversation")
router.register("knowledge", KnowledgeDocumentViewSet, basename="ai-knowledge")

urlpatterns = [
    path("", include(router.urls)),
]

