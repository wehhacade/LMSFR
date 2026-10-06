from django.urls import path

from . import views

urlpatterns = [
    path("stats", views.stats, name="baaris-stats"),
    path("analytics", views.analytics, name="baaris-analytics"),
    path("register-complete", views.register_complete, name="baaris-register-complete"),
    path("citizens", views.citizen_list, name="baaris-citizen-list"),
    path("citizens/<int:suspect_id>", views.citizen_detail, name="baaris-citizen-detail"),
    path("wanted", views.wanted_list, name="baaris-wanted-list"),
    path("wanted/types", views.wanted_types, name="baaris-wanted-types"),
    path("wanted/<int:wanted_id>", views.wanted_detail, name="baaris-wanted-detail"),
]
