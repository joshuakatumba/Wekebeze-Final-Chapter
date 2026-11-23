from django.contrib import admin
from .models import Quiz, QuizAttempt, QuizQuestion

admin.site.register(Quiz)
admin.site.register(QuizQuestion)
admin.site.register(QuizAttempt)

