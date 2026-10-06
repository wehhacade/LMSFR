from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.visitors.views import VisitorViewSet

router = DefaultRouter()
router.register("", VisitorViewSet, basename="visitor")

urlpatterns = [
    path("", include(router.urls)),
]
