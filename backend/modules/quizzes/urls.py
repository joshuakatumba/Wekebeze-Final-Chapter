from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import QuizQuestionViewSet, QuizViewSet

router = DefaultRouter()
router.register("questions", QuizQuestionViewSet, basename="quiz-question")
router.register("", QuizViewSet, basename="quiz")

urlpatterns = [
    path("", include(router.urls)),
]

