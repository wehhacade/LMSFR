from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DhacdooyinkaViewSet, NoocaDhacdooyinkaGuudViewSet, NoocaDhaxdooyinkaViewSet

router = DefaultRouter()
router.register("utility", NoocaDhacdooyinkaGuudViewSet, basename="dhacdooyinka-utility")
router.register("requirements", NoocaDhaxdooyinkaViewSet, basename="dhacdooyinka-requirements")
router.register("", DhacdooyinkaViewSet, basename="dhacdooyinka")

urlpatterns = [
    path("", include(router.urls)),
]
