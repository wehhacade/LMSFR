from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import face_views, legacy_views, mobile_views
from .views import (
    SuspectArrestViewSet,
    SuspectCaseViewSet,
    SuspectCommentViewSet,
    SuspectGuarantorViewSet,
    SuspectViewSet,
)

router = DefaultRouter()
router.register("cases", SuspectCaseViewSet, basename="suspect-case")
router.register("guarantors", SuspectGuarantorViewSet, basename="suspect-guarantor")
router.register("arrests", SuspectArrestViewSet, basename="suspect-arrest")
router.register("comments", SuspectCommentViewSet, basename="suspect-comment")
router.register("", SuspectViewSet, basename="suspect")

mobile_urlpatterns = [
    path("mobile/lookups/", mobile_views.mobile_lookups, name="mobile-suspect-lookups"),
    path("mobile/suspects/", mobile_views.mobile_suspects, name="mobile-suspects"),
    path("mobile/suspects/<int:id>/", mobile_views.mobile_suspect_detail_view, name="mobile-suspect-detail"),
    path("mobile/guarantors/<int:id>/", mobile_views.mobile_guarantors, name="mobile-guarantors"),
    path("mobile/cases/<int:id>/", mobile_views.mobile_suspect_cases, name="mobile-suspect-cases"),
]

legacy_urlpatterns = [
    path("suspects-create", legacy_views.suspects_create, name="legacy-suspects-create"),
    path("suspects/", legacy_views.suspects_list, name="legacy-suspects-list"),
    path("suspects_list_temp", legacy_views.suspects_list_temp, name="legacy-suspects-list-temp"),
    path("suspect-types/", legacy_views.suspect_types_list, name="legacy-suspect-types"),
    path("get-suspect-status/", legacy_views.get_suspect_status, name="legacy-get-suspect-status"),
    path("get-relationships", legacy_views.get_relationships, name="legacy-get-relationships"),
    path("get-region/", legacy_views.get_region, name="legacy-get-region"),
    path("get-sub-county/", legacy_views.get_sub_county, name="legacy-get-sub-county"),
    path("address/", legacy_views.address_list, name="legacy-suspect-address"),
    path("damiinka/create", legacy_views.damiinka_create, name="legacy-damiinka-create"),
    path("create-damiinka-api", legacy_views.create_damiinka_api, name="legacy-create-damiinka-api"),
    path("create-suspect-api", legacy_views.create_suspects_api, name="legacy-create-suspect-api"),
    path("register-complete", legacy_views.register_suspect_complete, name="legacy-register-complete"),
    path("face-match", face_views.face_match, name="legacy-face-match"),
    path("face-embedding", face_views.face_embedding_store, name="legacy-face-embedding"),
    path("suspect-lookup", face_views.suspect_lookup, name="legacy-suspect-lookup"),
    path("damiinka/view/<int:id>", legacy_views.damiinka_view, name="legacy-damiinka-view"),
    path("get-suspect-cases/<int:suspect_id>", legacy_views.get_suspect_cases, name="legacy-get-suspect-cases"),
    path("get-damiintayaasha/<int:suspect_id>", legacy_views.get_damiintayaasha, name="legacy-get-damiintayaasha"),
]

urlpatterns = mobile_urlpatterns + legacy_urlpatterns + [
    path("", include(router.urls)),
]
