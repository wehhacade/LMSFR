from django.urls import include, path

from apps.mobile.views.app_version import (
    AppVersionReleaseDetailView,
    AppVersionReleaseListView,
    AppVersionView,
)

from .views import HealthCheckView

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health-check"),
    path("app-version", AppVersionView.as_view(), name="app-version"),
    path("app-version/", AppVersionView.as_view(), name="app-version-slash"),
    path("app-releases", AppVersionReleaseListView.as_view(), name="app-releases"),
    path("app-releases/", AppVersionReleaseListView.as_view(), name="app-releases-slash"),
    path("app-releases/<int:pk>", AppVersionReleaseDetailView.as_view(), name="app-release-detail"),
    path("app-releases/<int:pk>/", AppVersionReleaseDetailView.as_view(), name="app-release-detail-slash"),
    path("", include("apps.legacy_api.urls")),
    path("", include("apps.accounts.urls")),
    path("", include("apps.audit.urls")),
    path("suspect/", include("apps.suspects.urls")),
    path("survey/", include("apps.surveys.urls")),
    path("", include("apps.forces.urls")),
    path("hubkadhigis/", include("apps.hubkadhigis.urls")),
    path("amniga/", include("apps.amniga.urls")),
    path("dhacdooyinka/", include("apps.dhacdooyinka.urls")),
    path("baaris/", include("apps.baaris.urls")),
    path("investigation/", include("apps.investigation.urls")),
    path("", include("apps.personnel.urls")),
    path("visitors/", include("apps.visitors.urls")),
]
