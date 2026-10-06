from django.urls import path

from . import views

urlpatterns = [
    path("login", views.investigation_login, name="investigation-login"),
    path("search", views.investigation_search, name="investigation-search"),
    path("get-suspect-investigation", views.investigation_search, name="investigation-search-alias"),
]
