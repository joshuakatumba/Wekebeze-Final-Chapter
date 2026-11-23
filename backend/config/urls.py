from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/core/", include("core.urls")),
    path("api/v1/accounts/", include("accounts.urls")),
    # Wekebeze domain modules
    path("api/v1/awareness/", include("modules.awareness.urls")),
    path("api/v1/quizzes/", include("modules.quizzes.urls")),
    path("api/v1/screening/", include("modules.screening.urls")),
    path("api/v1/ai/", include("modules.ai_assistant.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

