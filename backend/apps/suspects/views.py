from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsActiveUser
from apps.audit.mixins import AuditedViewSetMixin
from apps.core.cache import LONG, MEDIUM, cache_response, invalidate_cache

from .discussion import add_discussion_entry, suspect_discussion
from .models import Damiinada, Suspect, SuspectArrest, SuspectCase, SuspectComment, SuspectStatus
from .permissions import SuspectPermission
from .queries import cases_for_suspect, damiin_for_suspect, suspect_registry_qs
from .serializers import (
    DamiinadaPhotoUpdateSerializer,
    DamiinadaSerializer,
    DamiinCaseCreateSerializer,
    SuspectArrestSerializer,
    SuspectCaseSerializer,
    SuspectCommentSerializer,
    SuspectDetailSerializer,
    SuspectListSerializer,
    SuspectStatusSerializer,
    SuspectWriteSerializer,
)
from .services import create_damiin_and_case, parse_damiin_payload


class SuspectPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class SuspectViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    audit_module = "amniga"
    audit_entity = "suspect"
    permission_classes = [IsAuthenticated, IsActiveUser, SuspectPermission]
    pagination_class = SuspectPagination
    ordering_fields = ["last_seen", "updated_at", "name"]
    ordering = ["-updated_at"]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        if self.action in ("retrieve", "discussion"):
            return Suspect.objects.select_related(
                "created_by", "suspect_type", "capture_county", "capture_sub_county"
            )
        p = self.request.query_params
        period = p.get("period", "").strip().lower()
        filter_date = p.get("filter_date", "").strip()
        if period in ("today", "daily") and not filter_date:
            from zoneinfo import ZoneInfo

            filter_date = timezone.now().astimezone(ZoneInfo("Africa/Mogadishu")).date().isoformat()
        return suspect_registry_qs(
            search=p.get("search", "").strip(),
            district=p.get("district", "").strip(),
            county=p.get("county", "").strip(),
            status=p.get("status", "").strip(),
            risk=p.get("risk", "").strip(),
            suspect_type=p.get("suspect_type", "").strip(),
            filter_date=filter_date,
        )

    def perform_create(self, serializer):
        extra = {}
        if self.request.user.is_authenticated:
            extra["created_by"] = self.request.user
        serializer.save(**extra)
        invalidate_cache("suspect")

    def perform_update(self, serializer):
        super().perform_update(serializer)
        invalidate_cache("suspect")

    def perform_destroy(self, instance):
        super().perform_destroy(instance)
        invalidate_cache("suspect")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return SuspectWriteSerializer
        if self.action == "retrieve":
            return SuspectDetailSerializer
        return SuspectListSerializer

    @cache_response(timeout=MEDIUM, key_prefix="suspect.stats")
    @action(detail=False, methods=["get"])
    def stats(self, request):
        from datetime import datetime, time
        from zoneinfo import ZoneInfo

        mog = ZoneInfo("Africa/Mogadishu")
        today = timezone.now().astimezone(mog).date()
        month_start = today.replace(day=1)
        day_start = datetime.combine(today, time.min, tzinfo=mog)
        day_end = datetime.combine(today, time.max, tzinfo=mog)
        agg = Suspect.objects.aggregate(
            total=Count("id"),
            active=Count("id", filter=Q(is_released=False)),
            tuhunka_typed=Count("id", filter=Q(suspect_type__isnull=False, is_released=False)),
            this_month=Count("id", filter=Q(created_at__date__gte=month_start)),
            today_registered=Count(
                "id",
                filter=Q(created_at__gte=day_start, created_at__lte=day_end),
            ),
        )
        return Response(agg)

    @cache_response(timeout=LONG, key_prefix="suspect.districts")
    @action(detail=False, methods=["get"])
    def districts(self, request):
        from apps.accounts.models import County

        official = list(County.objects.order_by("name").values_list("name", flat=True))
        from_db = list(
            Suspect.objects.values_list("district", flat=True).distinct().order_by("district")
        )
        merged = sorted({*official, *from_db})
        return Response(merged)

    @cache_response(timeout=LONG, key_prefix="suspect.statuses")
    @action(detail=False, methods=["get"], url_path="status-types")
    def status_types(self, request):
        qs = SuspectStatus.objects.all()
        return Response(SuspectStatusSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def release(self, request, pk=None):
        suspect = self.get_object()
        new_status = (
            Suspect.Status.ACTIVE
            if suspect.status == Suspect.Status.CLEARED
            else Suspect.Status.CLEARED
        )
        Suspect.objects.filter(pk=suspect.pk).update(
            status=new_status,
            is_released=new_status == Suspect.Status.CLEARED,
            updated_at=timezone.now(),
        )
        suspect.refresh_from_db()
        invalidate_cache("suspect")
        serializer = SuspectDetailSerializer(suspect, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["get", "post"])
    def discussion(self, request, pk=None):
        suspect = self.get_object()
        if request.method == "POST":
            entry = add_discussion_entry(
                suspect_id=suspect.pk,
                kind=request.data.get("kind") or "response",
                target_id=request.data.get("target_id"),
                body=request.data.get("body") or "",
                user=request.user,
            )
            return Response(entry, status=status.HTTP_201_CREATED)
        return Response(suspect_discussion(suspect.pk, request=request))


class SuspectRelatedViewSetMixin:
    permission_classes = [IsAuthenticated, IsActiveUser, SuspectPermission]
    pagination_class = None
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = self.queryset.all()
        suspect_id = self.request.query_params.get("suspect", "").strip()
        if suspect_id:
            qs = qs.filter(suspect_id=suspect_id)
        return qs


class SuspectCaseViewSet(SuspectRelatedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = SuspectCaseSerializer
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        suspect_id = self.request.query_params.get("suspect", "").strip()
        if suspect_id:
            return cases_for_suspect(int(suspect_id))
        return (
            SuspectCase.objects.select_related(
                "tuhunka", "damiin", "capture_county", "capture_sub_county", "suspect"
            )
            .order_by("-created_at")
        )


class DamiinadaViewSet(SuspectRelatedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = DamiinadaSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        base = Damiinada.objects.select_related("county", "sub_county", "new_relationship")
        # Detail / photo updates resolve by pk — do not require ?suspect=.
        if getattr(self, "action", None) in ("retrieve", "partial_update"):
            return base.order_by("-created_at")
        suspect_id = self.request.query_params.get("suspect", "").strip()
        if suspect_id:
            return damiin_for_suspect(int(suspect_id))
        return base.order_by("-created_at")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        suspect_id = self.request.query_params.get("suspect", "").strip()
        if suspect_id:
            ctx["suspect_id"] = int(suspect_id)
        return ctx

    def partial_update(self, request, *args, **kwargs):
        damiin = self.get_object()
        serializer = DamiinadaPhotoUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(damiin=damiin)
        invalidate_cache("suspect")
        return Response(
            DamiinadaSerializer(damiin, context=self.get_serializer_context()).data,
        )

    def create(self, request, *args, **kwargs):
        serializer = DamiinCaseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        suspect_id = serializer.validated_data.get("suspect_id") or serializer.validated_data.get("suspect")
        if not suspect_id:
            suspect_id = request.query_params.get("suspect")
        payload = parse_damiin_payload(serializer.validated_data, suspect_id=int(suspect_id))
        case = create_damiin_and_case(payload, request.user)
        invalidate_cache("suspect")
        return Response(
            {
                "case": SuspectCaseSerializer(case, context={"request": request}).data,
                "damiin": DamiinadaSerializer(case.damiin, context={"request": request, "suspect_id": payload.suspect_id}).data
                if case.damiin
                else None,
                "message": f"Caseka {case.suspect.name} is successfully registered",
            },
            status=status.HTTP_201_CREATED,
        )


# Backward-compatible name for router registration.
SuspectGuarantorViewSet = DamiinadaViewSet


class SuspectArrestViewSet(SuspectRelatedViewSetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = SuspectArrest.objects.select_related("suspect")
    serializer_class = SuspectArrestSerializer
    http_method_names = ["get", "head", "options"]


class SuspectCommentViewSet(SuspectRelatedViewSetMixin, viewsets.ModelViewSet):
    queryset = SuspectComment.objects.select_related("suspect", "parent")
    serializer_class = SuspectCommentSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        reply_qs = SuspectComment.objects.only(
            "id", "suspect_id", "parent_id", "author_name", "body", "created_at"
        ).order_by("created_at")
        qs = SuspectComment.objects.select_related("suspect", "parent").prefetch_related(
            Prefetch("replies", queryset=reply_qs),
        )
        suspect_id = self.request.query_params.get("suspect", "").strip()
        if suspect_id:
            qs = qs.filter(suspect_id=suspect_id)
        if self.action == "list":
            qs = qs.filter(parent__isnull=True)
        return qs.order_by("-created_at")
