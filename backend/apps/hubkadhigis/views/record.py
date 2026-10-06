from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsActiveUser
from apps.audit.mixins import AuditedViewSetMixin
from apps.core.cache import LONG, MEDIUM, cache_response, invalidate_cache
from apps.hubkadhigis.models import DisarmamentRecord, ForceUnit, Rank, SurrenderLocation, WeaponType
from apps.hubkadhigis.permissions import DisarmamentPermission
from apps.hubkadhigis.serializers.lookup import (
    ForceUnitSerializer,
    RankSerializer,
    SurrenderLocationSerializer,
    WeaponTypeSerializer,
)
from apps.hubkadhigis.serializers.record import (
    DisarmamentDetailSerializer,
    DisarmamentListSerializer,
    DisarmamentWriteSerializer,
)
from apps.hubkadhigis.services.queries import (
    disarmament_analytics,
    disarmament_registry_qs,
    disarmament_stats,
    person_history_qs,
)
from apps.hubkadhigis.views.pagination import DisarmamentPagination


class DisarmamentRecordViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    audit_module = "hub"
    audit_entity = "disarmament_record"
    permission_classes = [IsAuthenticated, IsActiveUser, DisarmamentPermission]
    pagination_class = DisarmamentPagination
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        if self.action == "retrieve":
            return DisarmamentRecord.objects.select_related(
                "force_unit",
                "rank",
                "weapon_type",
                "county",
                "surrender_location",
                "created_by",
            ).prefetch_related("images")
        p = self.request.query_params
        qs = disarmament_registry_qs(
            search=p.get("search", "").strip(),
            county=p.get("county", "").strip(),
            weapon_type=p.get("weapon_type", "").strip(),
            force_unit=p.get("force_unit", "").strip(),
            has_images=p.get("has_images", "").strip(),
            status=p.get("status", "").strip(),
        )
        if self.action == "list":
            qs = qs.annotate(image_count=Count("images"))
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return DisarmamentWriteSerializer
        if self.action == "retrieve":
            return DisarmamentDetailSerializer
        return DisarmamentListSerializer

    def perform_create(self, serializer):
        serializer.save()
        invalidate_cache("hubkadhigis")

    def perform_update(self, serializer):
        super().perform_update(serializer)
        invalidate_cache("hubkadhigis")

    def perform_destroy(self, instance):
        super().perform_destroy(instance)
        invalidate_cache("hubkadhigis")

    @cache_response(timeout=MEDIUM, key_prefix="hubkadhigis.stats")
    @action(detail=False, methods=["get"])
    def stats(self, request):
        return Response(disarmament_stats())

    @cache_response(timeout=MEDIUM, key_prefix="hubkadhigis.analytics")
    @action(detail=False, methods=["get"])
    def analytics(self, request):
        return Response(disarmament_analytics())

    @cache_response(timeout=LONG, key_prefix="hubkadhigis.lookups")
    @action(detail=False, methods=["get"])
    def lookups(self, request):
        return Response(
            {
                "ranks": RankSerializer(Rank.objects.all(), many=True).data,
                "force_units": ForceUnitSerializer(ForceUnit.objects.all(), many=True).data,
                "weapon_types": WeaponTypeSerializer(WeaponType.objects.all(), many=True).data,
                "surrender_locations": SurrenderLocationSerializer(
                    SurrenderLocation.objects.all(), many=True
                ).data,
            }
        )

    @action(detail=False, methods=["get"], url_path="person-history")
    def person_history(self, request):
        phone = request.query_params.get("phone", "").strip()
        person_name = request.query_params.get("person_name", "").strip()
        if not phone and not person_name:
            return Response(
                {"detail": "phone or person_name query parameter is required."},
                status=400,
            )
        qs = person_history_qs(phone=phone, person_name=person_name)
        records = list(qs)
        first = records[0] if records else None
        serializer = DisarmamentListSerializer(
            records, many=True, context={"request": request}
        )
        return Response(
            {
                "count": len(records),
                "person_name": first.person_name if first else "",
                "phone_number": first.phone_number if first else "",
                "records": serializer.data,
            }
        )
