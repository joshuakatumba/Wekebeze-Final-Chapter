from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.concurrency import ConcurrencyBusyError, distributed_mutex
from core.permissions import has_role
from core.services import log_audit
from .models import Quiz, QuizAttempt, QuizQuestion
from .serializers import (
    AdminQuizDetailSerializer,
    AdminQuizQuestionSerializer,
    QuizAttemptSerializer,
    QuizDetailSerializer,
    QuizListSerializer,
)


class QuizViewSet(viewsets.ModelViewSet):
    pagination_class = None

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.AllowAny()]
        if self.action in ("submit", "my_attempts"):
            return [permissions.IsAuthenticated()]
        return [has_role("admin", "provider")()]

    def get_queryset(self):
        qs = Quiz.objects.prefetch_related("questions").all()
        user = self.request.user
        if not (user.is_authenticated and (user.is_platform_admin or user.role == "provider")):
            qs = qs.filter(status=Quiz.Status.PUBLISHED)
        cancer_type = self.request.query_params.get("cancer_type")
        language = self.request.query_params.get("language")
        if cancer_type:
            qs = qs.filter(cancer_type=cancer_type)
        if language:
            qs = qs.filter(language=language)
        return qs

    def get_serializer_class(self):
        if self.action == "list":
            return QuizListSerializer
        user = self.request.user
        if user.is_authenticated and (user.is_platform_admin or user.role == "provider") and self.request.query_params.get("admin") == "1":
            return AdminQuizDetailSerializer
        return QuizDetailSerializer

    def perform_create(self, serializer):
        obj = serializer.save()
        log_audit(self.request, "quiz.create", "Quiz", obj.id, {"title": obj.title})

    def perform_update(self, serializer):
        obj = serializer.save()
        log_audit(self.request, "quiz.update", "Quiz", obj.id, {"title": obj.title})

    def perform_destroy(self, instance):
        log_audit(self.request, "quiz.delete", "Quiz", instance.id, {"title": instance.title})
        instance.delete()

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        """Server-side grading: accepts { answers: { "<question_id>": <option_index> } }."""
        quiz = self.get_object()
        submitted = request.data.get("answers", {})
        if not isinstance(submitted, dict):
            return Response({"error": "answers must be an object mapping question_id to option index."}, status=status.HTTP_400_BAD_REQUEST)

        questions = list(quiz.questions.all())
        if not questions:
            return Response({"error": "This quiz has no questions."}, status=status.HTTP_400_BAD_REQUEST)

        score = 0
        breakdown = []
        for q in questions:
            chosen = submitted.get(str(q.id))
            is_correct = chosen is not None and int(chosen) == q.correct_answer
            if is_correct:
                score += 1
            breakdown.append({
                "question_id": str(q.id),
                "question": q.question,
                "chosen_answer": chosen,
                "correct_answer": q.correct_answer,
                "is_correct": is_correct,
                "explanation": q.explanation,
            })

        try:
            with distributed_mutex(f"quiz_submit:{request.user.id}:{quiz.id}", ttl_seconds=10):
                with transaction.atomic():
                    locked_quiz = Quiz.objects.select_for_update().get(pk=quiz.pk)
                    attempt = QuizAttempt.objects.create(
                        user=request.user,
                        quiz=locked_quiz,
                        answers=submitted,
                        score=score,
                        total_questions=len(questions),
                    )
        except ConcurrencyBusyError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_409_CONFLICT)

        return Response({
            "attempt": QuizAttemptSerializer(attempt).data,
            "breakdown": breakdown,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="attempts/me")
    def my_attempts(self, request):
        attempts = QuizAttempt.objects.filter(user=request.user).select_related("quiz")
        return Response(QuizAttemptSerializer(attempts, many=True).data)


class QuizQuestionViewSet(viewsets.ModelViewSet):
    serializer_class = AdminQuizQuestionSerializer
    permission_classes = [has_role("admin", "provider")]
    pagination_class = None

    def get_queryset(self):
        qs = QuizQuestion.objects.select_related("quiz").all()
        quiz_id = self.request.query_params.get("quiz")
        if quiz_id:
            qs = qs.filter(quiz_id=quiz_id)
        return qs

    def perform_create(self, serializer):
        obj = serializer.save()
        log_audit(self.request, "quiz.question.create", "QuizQuestion", obj.id, {"quiz": str(obj.quiz_id)})

