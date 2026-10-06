"""Root-level legacy URL paths — mirrors old /APIs/urls.py."""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

from apps.accounts.views.mobile_auth import (
    LegacyEmailTokenObtainPairView,
    MobileTokenObtainPairView,
    set_app_pin,
    verify_app_pin,
)
from apps.legacy_api.views import damiin, lookups, stubs, suspects_v2
from apps.mobile.views import endpoints as mobile
from apps.mobile.views import profile as mobile_profile
from apps.suspects import legacy_views, response_views, ptt_views, ptt_broadcast_views
from apps.suspects import face_views as suspect_face_views

stub = stubs.module_stub

urlpatterns = [
    # Auth (old paths)
    path("login/", LegacyEmailTokenObtainPairView.as_view(), name="legacy-token-obtain"),
    path("mobile/login/", MobileTokenObtainPairView.as_view(), name="legacy-mobile-login"),
    path("set-pin", set_app_pin, name="legacy-set-pin"),
    path("verify-pin", verify_app_pin, name="legacy-verify-pin"),
    path("token/refresh/", TokenRefreshView.as_view(), name="legacy-token-refresh"),
    path("token/verify/", TokenVerifyView.as_view(), name="legacy-token-verify"),
    path("change_password", mobile_profile.change_password_legacy, name="legacy-change-password"),
    # Profile + agent
    path("user-profile/", mobile_profile.user_profile, name="legacy-user-profile"),
    path("get-agent-login", mobile_profile.get_agent_login, name="legacy-get-agent-login"),
    path("get-agent-data", mobile_profile.get_agent_data, name="legacy-get-agent-data"),
    path("update-user-location-attempts", mobile_profile.update_user_location_attempts, name="legacy-update-location-attempts"),
    path("save-user-location", mobile_profile.save_user_location, name="legacy-save-user-location"),
    path("update-profile", mobile_profile.update_profile, name="legacy-update-profile"),
    # Suspects — same handlers as /api/v3/suspect/…
    path("suspects-create", legacy_views.suspects_create, name="root-suspects-create"),
    path("suspects/", legacy_views.suspects_list, name="root-suspects-list"),
    path("suspects_list_temp", legacy_views.suspects_list_temp, name="root-suspects-list-temp"),
    path("address/", legacy_views.address_list, name="root-address-list"),
    path("suspect-types/", legacy_views.suspect_types_list, name="root-suspect-types"),
    path("create-damiinka-api", legacy_views.create_damiinka_api, name="root-create-damiinka-api"),
    path("Damiinada/create", legacy_views.damiinka_create, name="root-damiinada-create"),
    path("Damiinada/view/<int:id>", legacy_views.damiinka_view, name="root-damiinada-view"),
    path("get-damiintayaasha/<int:suspect_id>", legacy_views.get_damiintayaasha, name="root-get-damiintayaasha"),
    path("get-suspect-cases/<int:suspect_id>", legacy_views.get_suspect_cases, name="root-get-suspect-cases"),
    path("create-suspect-api", legacy_views.create_suspects_api, name="root-create-suspect-api"),
    path("register-complete", legacy_views.register_suspect_complete, name="root-register-complete"),
    path("face-match", suspect_face_views.face_match, name="root-face-match"),
    path("face-embedding", suspect_face_views.face_embedding_store, name="root-face-embedding"),
    path("suspect-lookup", suspect_face_views.suspect_lookup, name="root-suspect-lookup"),
    path("suspect-list-images", mobile.suspect_list_images, name="root-suspect-list-images"),
    path("suspect-list-count", mobile.suspect_list_count, name="root-suspect-list-count"),
    path("update-suspect-tag/<int:user_id>/<int:suspect_id>", mobile.update_suspect_tag, name="root-update-suspect-tag"),
    path("suspect-report", mobile.suspect_report, name="root-suspect-report"),
    # Suspect responses + FCM + notices
    path("create-suspect-response", response_views.create_suspect_response, name="root-create-suspect-response"),
    path("create-suspect-comment", response_views.create_suspect_comment, name="root-create-suspect-comment"),
    path("create-comment-reply", response_views.create_comment_reply, name="root-create-comment-reply"),
    path("suspect-response", response_views.suspect_response_list, name="root-suspect-response"),
    path("response-comment", response_views.response_comment_list, name="root-response-comment"),
    path("comment-reply", response_views.comment_response_reply, name="root-comment-reply"),
    path("response-comment-images", response_views.response_comment_images, name="root-response-comment-images"),
    path("saveTokenToBackend", response_views.save_token_to_backend, name="root-save-fcm-token"),
    path("send_push_notification", response_views.send_push_notification, name="root-send-push"),
    path("send-notice", response_views.send_notice, name="root-send-notice"),
    path("notice-list", response_views.notice_list, name="root-notice-list"),
    path("update-status", response_views.update_notice_status, name="root-update-notice-status"),
    # Nearby walkie-talkie (PTT)
    path("nearby/users-brief", ptt_views.nearby_users_brief, name="root-nearby-users-brief"),
    path("nearby/ptt/start", ptt_views.ptt_start, name="root-ptt-start"),
    path("nearby/ptt/pending", ptt_views.ptt_pending, name="root-ptt-pending"),
    path("nearby/ptt/session/<str:session_id>", ptt_views.ptt_session, name="root-ptt-session"),
    path("nearby/ptt/signal", ptt_views.ptt_signal, name="root-ptt-signal"),
    path("nearby/ptt/end", ptt_views.ptt_end, name="root-ptt-end"),
    # County-wide LiveKit walkie broadcast
    path("nearby/ptt/broadcast/start", ptt_broadcast_views.ptt_broadcast_start, name="root-ptt-broadcast-start"),
    path("nearby/ptt/broadcast/pending", ptt_broadcast_views.ptt_broadcast_pending, name="root-ptt-broadcast-pending"),
    path("nearby/ptt/broadcast/join", ptt_broadcast_views.ptt_broadcast_join, name="root-ptt-broadcast-join"),
    path("nearby/ptt/broadcast/session/<str:session_id>", ptt_broadcast_views.ptt_broadcast_session, name="root-ptt-broadcast-session"),
    path("nearby/ptt/broadcast/end", ptt_broadcast_views.ptt_broadcast_end, name="root-ptt-broadcast-end"),
    # Lookups
    path("get-region", legacy_views.get_region, name="root-get-region"),
    path("get-county", lookups.get_county, name="root-get-county"),
    path("get-sub-county", lookups.get_sub_county, name="root-get-sub-county"),
    path("get-laamaha", lookups.get_laamaha, name="root-get-laamaha"),
    path("get-IdentityType", lookups.get_identity_type, name="root-get-identity-type"),
    path("get-relationships", lookups.get_relationships, name="root-get-relationships"),
    path("get-suspect-status", lookups.get_suspect_status, name="root-get-suspect-status"),
    path("get-countries", lookups.get_countries, name="root-get-countries"),
    # Damiin v2
    path("get-Damiinada-info/<int:damiin_id>", damiin.get_damiinada_info, name="root-get-damiinada-info"),
    path("get-Damiinada-info/<int:Damiinada_id>", damiin.get_damiinada_info, name="root-get-damiinada-info-alt"),
    path("get-damiin-cases/<int:damiin_id>", damiin.get_damiin_cases, name="root-get-damiin-cases"),
    path("get-dhamaan-Damiinada", damiin.get_dhamaan_damiinada, name="root-get-dhamaan-damiinada"),
    path("get-damiinka", damiin.get_dhamaan_damiinada, name="root-get-damiinka"),
    path("get-damiin-list", damiin.get_damiin_list, name="root-get-damiin-list"),
    # Suspects v2 mobile
    path("suspect-list", suspects_v2.suspect_list, name="root-suspect-list"),
    path("single-suspect-data", suspects_v2.single_suspect_data, name="root-single-suspect-data"),
    path("get-suspect-list/", suspects_v2.get_user_suspects, name="root-get-suspect-list"),
    path("get-suspect-list/<int:user_id>/", suspects_v2.get_user_suspects, name="root-get-suspect-list-user"),
    # Cars
    path("car-modal-list", mobile.car_modal_list, name="root-car-modal-list"),
    path("create-suspect-car", mobile.create_suspect_car, name="root-create-suspect-car"),
    path("suspect-car-list", mobile.suspect_car_list, name="root-suspect-car-list"),
    # Reports (daily warbixin)
    path("create-report-api", mobile.create_report, name="root-create-report"),
    path("update-report-api/<int:id>", mobile.update_report, name="root-update-report"),
    path("report-list-all", mobile.report_list_all, name="root-report-list"),
    # Cabasho
    path("cabasho-list", mobile.cabasho_list, name="root-cabasho-list"),
    path("cabashada-appka", mobile.create_cabashada_appka, name="root-cabashada-appka"),
    path("update-cabashada-appka/<int:id>", mobile.update_cabashada_appka, name="root-update-cabashada-appka"),
    # Documents + wanted
    path("get-documents", mobile.get_documents, name="root-get-documents"),
    path("wanted-list", mobile.wanted_list_api, name="root-wanted-list"),
    path("wanted-detail", mobile.wanted_detail_api, name="root-wanted-detail"),
    # Admin mobile
    path("top-admin-page", mobile.top_admin_page, name="root-top-admin-page"),
    path("top-user", mobile.top_user, name="root-top-user"),
    path("county-user-data", mobile.county_user_data, name="root-county-user-data"),
    path("users", mobile.user_management, name="root-users"),
    path("users-status", mobile.update_user_status, name="root-users-status"),
    path("users-bulk-status", mobile.bulk_update_user_status, name="root-users-bulk-status"),
    path(
        "app-installation/departments",
        mobile.app_installation_departments,
        name="root-app-installation-departments",
    ),
    path(
        "app-installation/users",
        mobile.app_installation_users,
        name="root-app-installation-users",
    ),
    path(
        "app-installation/update",
        mobile.update_app_installation,
        name="root-app-installation-update",
    ),
    path("users/change-county", mobile.change_user_county, name="root-users-change-county"),
    path("reset-user-password", mobile.reset_user_password, name="root-reset-user-password"),
    # Module mobile logins (same JWT login as /login/)
    path("surveys-login", LegacyEmailTokenObtainPairView.as_view(), name="legacy-surveys-login"),
    path("hubkadhigis-login", LegacyEmailTokenObtainPairView.as_view(), name="legacy-hubkadhigis-login"),
    path("dhacdooyinka-login", LegacyEmailTokenObtainPairView.as_view(), name="legacy-dhacdooyinka-login"),
    # Modules not yet ported — explicit stubs
    path("surveys-counties", stub("surveys"), name="stub-surveys-counties"),
    path("get-Warbixin-type", stub("sirdoon"), name="stub-sirdoon"),
    path("today-counts", stub("monitor"), name="stub-monitor"),
    path("cars/create", stub("cars"), name="stub-cars-create"),
    path("get_cars", stub("cars"), name="stub-get-cars"),
]
