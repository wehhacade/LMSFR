from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import County, Region, Section, SubCounty
from apps.accounts.permissions import IsActiveUser
from apps.accounts.serializers.lookup import CountySerializer, RegionSerializer, SubCountySerializer
from apps.core.cache import MEDIUM, cache_response, invalidate_cache
from apps.dhacdooyinka.models import Dhacdooyinka, Dhibanayaashas, Dhibane_documents, Faahfaahinta, NoocaDhaxdooyinka
from apps.dhacdooyinka.permissions import DhacdooyinkaPermission
from apps.dhacdooyinka.serializers.lookup import NoocaDhaxdooyinkaSerializer
from apps.dhacdooyinka.serializers.record import (
    DhibanayaashaListSerializer,
    DhibanayaashaWriteSerializer,
    DhacdooyinkaDetailSerializer,
    DhacdooyinkaListSerializer,
    DhacdooyinkaWriteSerializer,
    FaahfaahintaSerializer,
    FaahfaahintaWriteSerializer,
)
from apps.dhacdooyinka.services.analytics import dhacdooyinka_analytics
from apps.dhacdooyinka.views.pagination import DhacdooyinkaPagination


class SectionSerializer:
    """Inline import avoided — minimal serializer for lookups."""

    @staticmethod
    def serialize_many(qs):
        return [{"id": s.id, "name": s.name, "sub_county": s.sub_county_id} for s in qs]


def dhacdooyinka_queryset(request):
    qs = Dhacdooyinka.objects.select_related(
        "gobolka",
        "degmada",
        "waaxda",
        "laanta",
        "nooca_dhacdada",
        "recorded_by",
    ).annotate(victim_count=Count("dhibanayaashas")).order_by("-date_recorded")

    p = request.query_params
    search = p.get("search", "").strip()
    year = p.get("year", "").strip()
    month = p.get("month", "").strip()

    if search:
        qs = qs.filter(
            Q(tixraac_lambar__icontains=search)
            | Q(cidda_fulisay__icontains=search)
            | Q(gobolka__name__icontains=search)
            | Q(degmada__name__icontains=search)
            | Q(waaxda__name__icontains=search)
            | Q(nooca_dhacdada__type__icontains=search)
        )
    if year:
        try:
            year_int = int(year)
        except ValueError:
            year_int = None
        year_q = Q(year=year)
        if year_int is not None:
            year_q |= Q(date_recorded__year=year_int)
        qs = qs.filter(year_q)
    if month:
        month_norm = month.zfill(2) if len(month) == 1 else month
        try:
            month_int = int(month_norm)
        except ValueError:
            month_int = None
        month_q = Q(month=month_norm) | Q(month=month.lstrip("0") or month)
        if month_int is not None:
            month_q |= Q(date_recorded__month=month_int)
        qs = qs.filter(month_q)

    return qs


class DhacdooyinkaRecordViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, DhacdooyinkaPermission]
    pagination_class = DhacdooyinkaPagination
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        if self.action == "retrieve":
            return Dhacdooyinka.objects.select_related(
                "gobolka",
                "degmada",
                "waaxda",
                "laanta",
                "nooca_dhacdada",
                "recorded_by",
            ).prefetch_related(
                "dhibanayaashas_set__dhibane_documents_set",
                "dhacdodocuments_set",
                "faahfaahinta_set__recorded_by",
            )
        return dhacdooyinka_queryset(self.request)

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return DhacdooyinkaWriteSerializer
        if self.action == "retrieve":
            return DhacdooyinkaDetailSerializer
        return DhacdooyinkaListSerializer

    def perform_create(self, serializer):
        serializer.save()
        invalidate_cache("dhacdooyinka")

    def perform_update(self, serializer):
        serializer.save()
        invalidate_cache("dhacdooyinka")

    def perform_destroy(self, instance):
        instance.delete()
        invalidate_cache("dhacdooyinka")

    @action(detail=True, methods=["post"], url_path="add-victim")
    def add_victim(self, request, pk=None):
        dhacdo = self.get_object()
        serializer = DhibanayaashaWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        victim = Dhibanayaashas.objects.create(
            dhacdo=dhacdo,
            recorded_by=request.user if request.user.is_authenticated else None,
            year=dhacdo.year,
            month=dhacdo.month,
            **serializer.validated_data,
        )

        uploaded_files = request.FILES.getlist("victim_document")
        if uploaded_files:
            Dhibane_documents.objects.bulk_create(
                Dhibane_documents(
                    dhibane=victim,
                    user=request.user if request.user.is_authenticated else None,
                    document=uploaded,
                )
                for uploaded in uploaded_files
            )

        invalidate_cache("dhacdooyinka")
        return Response(
            DhibanayaashaListSerializer(victim, context={"request": request}).data,
            status=201,
        )

    @action(detail=True, methods=["post"], url_path="add-update")
    def add_update(self, request, pk=None):
        dhacdo = self.get_object()
        serializer = FaahfaahintaWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        update = Faahfaahinta.objects.create(
            dhacdo=dhacdo,
            recorded_by=request.user if request.user.is_authenticated else None,
            year=dhacdo.year,
            month=dhacdo.month,
            **serializer.validated_data,
        )
        if not (dhacdo.tafaasiisha_goobta_dhacdada or "").strip() and update.fahfaahin:
            dhacdo.tafaasiisha_goobta_dhacdada = update.fahfaahin
            dhacdo.save(update_fields=["tafaasiisha_goobta_dhacdada"])

        invalidate_cache("dhacdooyinka")
        return Response(
            FaahfaahintaSerializer(update, context={"request": request}).data,
            status=201,
        )

    @cache_response(timeout=MEDIUM, key_prefix="dhacdooyinka.stats")
    @action(detail=False, methods=["get"])
    def stats(self, request):
        qs = dhacdooyinka_queryset(request)
        return Response({"total": qs.count()})

    @cache_response(timeout=MEDIUM, key_prefix="dhacdooyinka.analytics")
    @action(detail=False, methods=["get"])
    def analytics(self, request):
        return Response(dhacdooyinka_analytics())

    @action(detail=False, methods=["get"])
    def lookups(self, request):
        sub_county = request.query_params.get("sub_county")
        sections_qs = Section.objects.order_by("name")
        if sub_county:
            sections_qs = sections_qs.filter(sub_county_id=sub_county)
        return Response(
            {
                "regions": RegionSerializer(Region.objects.order_by("name"), many=True).data,
                "counties": CountySerializer(
                    County.objects.select_related("region").order_by("name"), many=True
                ).data,
                "sub_counties": SubCountySerializer(
                    SubCounty.objects.select_related("county").order_by("name"), many=True
                ).data,
                "sections": SectionSerializer.serialize_many(sections_qs),
                "nooca_types": NoocaDhaxdooyinkaSerializer(
                    NoocaDhaxdooyinka.objects.select_related("nooca_dhacdooyinka_guud").order_by("type"),
                    many=True,
                ).data,
            }
        )
