from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ForceViewSet

router = DefaultRouter()
router.register("forces", ForceViewSet, basename="force")

urlpatterns = [
    path("", include(router.urls)),
]
