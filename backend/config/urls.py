from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v3/auth/", include("apps.accounts.auth_urls")),
    path("api/v3/", include("apps.api.urls")),
    # Legacy mobile apps (Ilaalo Shacab, Hub-Kadhigis, etc.) still call /api/v2/
    path("api/v2/", include("apps.api.urls")),
]

if settings.DEBUG and "silk" in settings.INSTALLED_APPS:
    urlpatterns += [path("silk/", include("silk.urls", namespace="silk"))]

# Gunicorn does not serve static files. Apache proxies /static/ here, so admin
# CSS must be answered by Django from the collectstatic output.
urlpatterns += [
    re_path(r"^static/(?P<path>.*)$", serve, {"document_root": settings.STATIC_ROOT}),
]

if settings.DEBUG or getattr(settings, "SERVE_MEDIA", False):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
