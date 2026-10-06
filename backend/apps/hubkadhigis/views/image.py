from django.db.models import Q

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsActiveUser
from apps.hubkadhigis.models import DisarmamentImage
from apps.hubkadhigis.permissions import DisarmamentPermission
from apps.hubkadhigis.serializers.image import DisarmamentImageSerializer
from apps.hubkadhigis.views.pagination import DisarmamentPagination


class DisarmamentImageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, DisarmamentPermission]
    serializer_class = DisarmamentImageSerializer
    pagination_class = DisarmamentPagination
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        qs = DisarmamentImage.objects.select_related(
            "record",
            "weapon_type",
            "county",
            "surrender_location",
            "uploaded_by",
        )
        record_id = self.request.query_params.get("record")
        if record_id:
            qs = qs.filter(record_id=record_id)
            return qs.order_by("-created_at")

        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(record__reference_number__icontains=search)
                | Q(record__person_name__icontains=search)
                | Q(caption__icontains=search)
            )
        return qs.order_by("-created_at")
