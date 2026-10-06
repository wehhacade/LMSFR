from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsActiveUser
from apps.audit.models import APITrafficLog, AuditTrail, ErrorLog
from apps.audit.permissions import CanViewAPITraffic, CanViewAudit, CanViewErrorLogs
from apps.audit.serializers import (
    APITrafficSerializer,
    AuditStatsSerializer,
    AuditTrailCreateSerializer,
    AuditTrailSerializer,
    ErrorLogDetailSerializer,
    ErrorLogListSerializer,
)


class AuditPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class AuditTrailViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = AuditTrail.objects.select_related("user").order_by("-created_at")
    pagination_class = AuditPagination

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated(), IsActiveUser()]
        return [IsAuthenticated(), IsActiveUser(), CanViewAudit()]

    def get_serializer_class(self):
        if self.action == "create":
            return AuditTrailCreateSerializer
        return AuditTrailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search", "").strip()
        submodule = self.request.query_params.get("submodule", "").strip()
        event_type = self.request.query_params.get("event_type", "").strip()
        module = self.request.query_params.get("module", "").strip()
        user_id = self.request.query_params.get("user", "").strip()
        today = self.request.query_params.get("today", "").strip().lower()

        if search:
            qs = qs.filter(
                Q(action__icontains=search)
                | Q(submodule__icontains=search)
                | Q(module__icontains=search)
                | Q(page__icontains=search)
                | Q(click_target__icontains=search)
                | Q(entity_type__icontains=search)
                | Q(user__email__icontains=search)
                | Q(ip_address__icontains=search)
            )
        if submodule:
            qs = qs.filter(submodule__icontains=submodule)
        if event_type:
            qs = qs.filter(event_type=event_type)
        if module:
            qs = qs.filter(module__icontains=module)
        if user_id:
            qs = qs.filter(user_id=user_id)
        if today in ("1", "true", "yes"):
            qs = qs.filter(created_at__date=timezone.localdate())
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        if instance is None:
            return Response({"detail": "Logged."}, status=201)
        return Response(AuditTrailSerializer(instance).data, status=201)

    @action(detail=False, methods=["get"])
    def today(self, request):
        qs = self.get_queryset().filter(created_at__date=timezone.localdate())
        page = self.paginate_queryset(qs)
        serializer = AuditTrailSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)


class ErrorLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = ErrorLog.objects.select_related("user").order_by("-created_at")
    permission_classes = [IsAuthenticated, IsActiveUser, CanViewErrorLogs]
    pagination_class = AuditPagination

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ErrorLogDetailSerializer
        return ErrorLogListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search", "").strip()
        today = self.request.query_params.get("today", "").strip().lower()
        if search:
            qs = qs.filter(
                Q(expected_error__icontains=search)
                | Q(field_error__icontains=search)
                | Q(path__icontains=search)
            )
        if today in ("1", "true", "yes"):
            qs = qs.filter(created_at__date=timezone.localdate())
        return qs

    @action(detail=False, methods=["get"])
    def today(self, request):
        qs = self.get_queryset().filter(created_at__date=timezone.localdate())
        page = self.paginate_queryset(qs)
        serializer = ErrorLogListSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)


class APITrafficViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = APITrafficLog.objects.select_related("user").order_by("-created_at")
    serializer_class = APITrafficSerializer
    permission_classes = [IsAuthenticated, IsActiveUser, CanViewAPITraffic]
    pagination_class = AuditPagination

    def get_queryset(self):
        qs = super().get_queryset()
        path = self.request.query_params.get("path", "").strip()
        if path:
            qs = qs.filter(path__icontains=path)
        return qs


class AuditStatsViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, CanViewAudit]

    def list(self, request):
        today = timezone.localdate()
        data = {
            "audits_today": AuditTrail.objects.filter(created_at__date=today).count(),
            "errors_today": ErrorLog.objects.filter(created_at__date=today).count(),
            "traffic_today": APITrafficLog.objects.filter(created_at__date=today).count(),
            "total_audits": AuditTrail.objects.count(),
        }
        return Response(AuditStatsSerializer(data).data)
