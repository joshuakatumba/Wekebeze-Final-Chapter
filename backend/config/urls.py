from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404, JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve


def spa_fallback(request, resource_path=""):
    """Serve the built React frontend (assets + SPA index.html) when present."""
    dist_dir = Path(getattr(settings, "FRONTEND_DIST_DIR", settings.BASE_DIR / "frontend_dist"))
    if dist_dir.exists():
        if resource_path:
            candidate = (dist_dir / resource_path).resolve()
            if str(candidate).startswith(str(dist_dir.resolve())) and candidate.is_file():
                return serve(request, resource_path, document_root=str(dist_dir))
        index_file = dist_dir / "index.html"
        if index_file.is_file():
            return FileResponse(open(index_file, "rb"), content_type="text/html; charset=utf-8")
    if resource_path:
        raise Http404("Not found")
    return JsonResponse({"service": "Wekebeze API", "status": "ok", "health": "/api/v1/core/health/"})


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

if not getattr(settings, "AZURE_ACCOUNT_NAME", ""):
    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    ]

# Serve React SPA for root and all non-API/non-admin client-side routes
urlpatterns += [
    re_path(r"^(?!(?:api|admin|static|media)(?:/|$))(?P<resource_path>.*)$", spa_fallback),
]
