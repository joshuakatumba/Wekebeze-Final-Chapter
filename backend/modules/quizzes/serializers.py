from rest_framework import serializers
from .models import Quiz, QuizAttempt, QuizQuestion


class PublicQuizQuestionSerializer(serializers.ModelSerializer):
    """Omits correct_answer and explanation until submission (BRD Module D security rule)."""

    class Meta:
        model = QuizQuestion
        fields = ["id", "question", "options", "order"]


class AdminQuizQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuizQuestion
        fields = ["id", "quiz", "question", "options", "correct_answer", "explanation", "order"]
        read_only_fields = ["id"]


class QuizListSerializer(serializers.ModelSerializer):
    question_count = serializers.IntegerField(source="questions.count", read_only=True)

    class Meta:
        model = Quiz
        fields = [
            "id", "title", "description", "cancer_type", "language",
            "status", "question_count", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class QuizDetailSerializer(QuizListSerializer):
    questions = PublicQuizQuestionSerializer(many=True, read_only=True)

    class Meta(QuizListSerializer.Meta):
        fields = QuizListSerializer.Meta.fields + ["questions"]


class AdminQuizDetailSerializer(QuizListSerializer):
    questions = AdminQuizQuestionSerializer(many=True, read_only=True)

    class Meta(QuizListSerializer.Meta):
        fields = QuizListSerializer.Meta.fields + ["questions"]


class QuizAttemptSerializer(serializers.ModelSerializer):
    quiz_title = serializers.CharField(source="quiz.title", read_only=True)
    cancer_type = serializers.CharField(source="quiz.cancer_type", read_only=True)
    percentage = serializers.SerializerMethodField()

    class Meta:
        model = QuizAttempt
        fields = [
            "id", "quiz", "quiz_title", "cancer_type", "score",
            "total_questions", "percentage", "completed_at",
        ]
        read_only_fields = fields

    def get_percentage(self, obj):
        if not obj.total_questions:
            return 0
        return round((obj.score / obj.total_questions) * 100)

