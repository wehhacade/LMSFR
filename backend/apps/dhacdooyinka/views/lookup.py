from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsActiveUser
from apps.accounts.views.users import AccountsLargePagination, LookupViewSetMixin
from apps.dhacdooyinka.models import NoocaDhacdooyinkaGuud, NoocaDhaxdooyinka
from apps.dhacdooyinka.permissions import DhacdooyinkaPermission
from apps.dhacdooyinka.serializers.lookup import (
    NoocaDhacdooyinkaGuudSerializer,
    NoocaDhaxdooyinkaSerializer,
)


class NoocaDhacdooyinkaGuudViewSet(LookupViewSetMixin, viewsets.ModelViewSet):
    queryset = NoocaDhacdooyinkaGuud.objects.order_by("name")
    serializer_class = NoocaDhacdooyinkaGuudSerializer
    pagination_class = AccountsLargePagination
    permission_classes = [IsAuthenticated, IsActiveUser, DhacdooyinkaPermission]


class NoocaDhaxdooyinkaViewSet(LookupViewSetMixin, viewsets.ModelViewSet):
    queryset = NoocaDhaxdooyinka.objects.select_related("nooca_dhacdooyinka_guud").order_by("type")
    serializer_class = NoocaDhaxdooyinkaSerializer
    pagination_class = AccountsLargePagination
    permission_classes = [IsAuthenticated, IsActiveUser, DhacdooyinkaPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(type__icontains=search)
        utility = self.request.query_params.get("utility")
        if utility:
            qs = qs.filter(nooca_dhacdooyinka_guud_id=utility)
        return qs
