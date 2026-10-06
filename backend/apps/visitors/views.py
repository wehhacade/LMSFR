from django.conf import settings
from django.db.models import Count, Q
from django.utils.dateparse import parse_date, parse_datetime


def _boqde_creator_q() -> Q:
    q = Q()
    for alias in BOQDE_TYPE_ALIASES:
        q |= Q(created_by__user_type__name__iexact=alias)
    return q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsActiveUser
from apps.audit.mixins import AuditedViewSetMixin
from apps.visitors.models import VisitAllegation, VisitDestination, Visitor
from apps.visitors.nira import is_matchable_nira, normalize_visitor_nira
from apps.visitors.permissions import BOQDE_TYPE_ALIASES, VisitorsPermission, is_boqde
from apps.visitors.services.access_gateway_client import (
    AccessGatewayError,
    get_otp_profile,
    get_seeding_reasons,
    initiate_seeding_otp,
)
from apps.visitors.serializers import (
    VisitorDetailSerializer,
    VisitorListSerializer,
    VisitorWriteSerializer,
)
from apps.visitors.services.analytics import visitors_analytics, visitors_stats


def _as_date(value):
    if value is None:
        return None
    if hasattr(value, "date") and callable(value.date):
        try:
            return value.date()
        except Exception:
            return value
    return value


class VisitorsPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 100


class VisitorViewSet(AuditedViewSetMixin, viewsets.ModelViewSet):
    """CRUD for Booqdeyaal / Visitors — web + future mobile (JWT)."""

    audit_module = "visitors"
    audit_entity = "visitor"
    permission_classes = [IsAuthenticated, IsActiveUser, VisitorsPermission]
    pagination_class = VisitorsPagination
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = (
            Visitor.objects.filter(is_hidden=False)
            .select_related("created_by", "created_by__user_type")
            .annotate(visit_count_ann=Count("visits", distinct=True))
        )
        if self.action == "retrieve":
            qs = qs.prefetch_related("visits", "visits__created_by")
        user = self.request.user
        if is_boqde(user) and not (
            user.is_superuser or user.is_staff or getattr(user, "is_admin", False)
        ):
            qs = qs.filter(_boqde_creator_q())

        p = self.request.query_params
        search = (p.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(full_name__icontains=search)
                | Q(mother_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(nira__icontains=search)
                | Q(visits__visiting__icontains=search)
                | Q(visits__contact_name__icontains=search)
                | Q(visits__relationship__icontains=search)
                | Q(visits__allegation__name__icontains=search)
            ).distinct()

        verified = (p.get("verified") or "").strip().lower()
        if verified in ("1", "true", "yes"):
            qs = qs.filter(verified=True)
        elif verified in ("0", "false", "no"):
            qs = qs.filter(verified=False)

        date_from = (p.get("date_from") or "").strip()
        date_to = (p.get("date_to") or "").strip()
        if date_from:
            d = _as_date(parse_datetime(date_from) or parse_date(date_from))
            if d:
                qs = qs.filter(visited_at__date__gte=d)
        if date_to:
            d = _as_date(parse_datetime(date_to) or parse_date(date_to))
            if d:
                qs = qs.filter(visited_at__date__lte=d)

        return qs.order_by("-visited_at", "-id")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return VisitorWriteSerializer
        if self.action == "retrieve":
            return VisitorDetailSerializer
        return VisitorListSerializer

    @action(detail=False, methods=["get"])
    def destinations(self, request):
        rows = VisitDestination.objects.filter(is_active=True).order_by("sort_order", "id")
        return Response([{"id": row.id, "name": row.name} for row in rows])

    @action(detail=False, methods=["get"])
    def allegations(self, request):
        rows = VisitAllegation.objects.filter(is_active=True).order_by("sort_order", "id")
        return Response([{"id": row.id, "name": row.name} for row in rows])

    @action(detail=False, methods=["get"])
    def stats(self, request):
        return Response(visitors_stats(request.user))

    @action(detail=False, methods=["get"])
    def analytics(self, request):
        range_str = (request.query_params.get("range") or "7d").strip() or "7d"
        report_date = parse_date((request.query_params.get("date") or "").strip())
        return Response(visitors_analytics(request.user, range_str=range_str, end_date=report_date))

    def _normalize_reason_items(self, payload) -> list[dict]:
        """
        Best-effort normalization for gateway reason payload.
        We only need: reason code + display label.
        """
        if payload is None:
            return []
        if isinstance(payload, list):
            items = payload
        elif isinstance(payload, dict):
            if isinstance(payload.get("reasons"), list):
                items = payload.get("reasons") or []
            elif isinstance(payload.get("data"), list):
                items = payload.get("data") or []
            else:
                items = []
        else:
            items = []

        out: list[dict] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            code = (
                str(item.get("code") or item.get("seedingReasonCode") or item.get("value") or item.get("id") or "")
            ).strip()
            label = (
                str(item.get("label") or item.get("name") or item.get("description") or code or "")
            ).strip()
            if not code:
                continue
            out.append({"code": code, "label": label, "raw": item})
        return out

    def _pick_default_reason_code(self, reasons: list[dict]) -> str:
        env_default = (getattr(settings, "ACCESS_GATEWAY_DEFAULT_SEEDING_REASON_CODE", "") or "").strip()
        if env_default:
            return env_default
        return reasons[0]["code"] if reasons else ""

    def _extract_nira(self, request) -> str:
        """NIRA / idNumber from query or body (photo is never used for search)."""
        data = getattr(request, "data", None) or {}
        params = request.query_params
        for source in (params, data):
            for key in (
                "nira",
                "Nira",
                "NIRA",
                "idNumber",
                "id_number",
                "idnumber",
                "search",
            ):
                raw = source.get(key)
                if raw is None:
                    continue
                value = normalize_visitor_nira(raw)
                if value:
                    return value
        return ""

    def _find_local_visitor(self, nira: str):
        nira = normalize_visitor_nira(nira)
        if not is_matchable_nira(nira):
            return None
        return (
            self.get_queryset()
            .prefetch_related("visits", "visits__created_by")
            .filter(nira__iexact=nira)
            .order_by("id")
            .first()
        )

    def _local_visitor_payload(self, request, visitor) -> dict:
        data = VisitorDetailSerializer(visitor, context={"request": request}).data
        visit_count = data.get("visit_count") or 0
        return {
            "isError": False,
            "found": True,
            "source": "local",
            "isReturning": visit_count >= 1,
            "message": "Wuu soo booqday" if visit_count >= 1 else None,
            "visitor": data,
            "localVisitor": data,
        }

    @action(detail=False, methods=["get"], url_path="nira/reasons")
    def nira_reasons(self, request):
        try:
            payload = get_seeding_reasons()
        except AccessGatewayError as e:
            return Response({"Message": str(e), "isError": True}, status=503)

        reasons = self._normalize_reason_items(payload)
        default_code = self._pick_default_reason_code(reasons)
        return Response({"isError": False, "reasons": reasons, "defaultReasonCode": default_code})

    @action(detail=False, methods=["post"], url_path="nira/initiate")
    def nira_initiate(self, request):
        """Resolve by NIRA number only: local first, then Access Gateway OTP.

        Photo/face is never used here — the app should send idNumber/nira after
        capture. Returning visitors short-circuit without calling NIRA.
        """
        id_number = self._extract_nira(request)
        if not id_number:
            return Response({"Message": "idNumber waa lagama maarmaan", "isError": True}, status=400)

        local = self._find_local_visitor(id_number)
        if local:
            payload = self._local_visitor_payload(request, local)
            payload["gatewaySkipped"] = True
            return Response(payload)

        seeding_reason_code = (
            request.data.get("seedingReasonCode")
            or request.data.get("seeding_reason_code")
            or request.data.get("reasonCode")
        )
        seeding_reason_code = (seeding_reason_code or "").strip()
        if not seeding_reason_code:
            env_default = (getattr(settings, "ACCESS_GATEWAY_DEFAULT_SEEDING_REASON_CODE", "") or "").strip()
            if env_default:
                seeding_reason_code = env_default

        # If default still missing, fetch reasons and use the first code.
        if not seeding_reason_code:
            try:
                payload = get_seeding_reasons()
                reasons = self._normalize_reason_items(payload)
                seeding_reason_code = self._pick_default_reason_code(reasons)
            except AccessGatewayError as e:
                return Response({"Message": str(e), "isError": True}, status=503)

        if not seeding_reason_code:
            return Response({"Message": "Gateway: reason code lama helin", "isError": True}, status=400)

        try:
            otp_payload = initiate_seeding_otp(
                id_number=str(id_number),
                seeding_reason_code=seeding_reason_code,
            )
        except AccessGatewayError as e:
            return Response({"Message": str(e), "isError": True}, status=503)

        # Pass-through JSON (gateway might add otpConsentId, etc.)
        return Response(
            {
                "isError": False,
                "found": False,
                "source": "nira",
                "reasonCode": seeding_reason_code,
                "gateway": otp_payload,
            }
        )

    @action(detail=False, methods=["post"], url_path="nira/profile")
    def nira_profile(self, request):
        id_number = self._extract_nira(request)
        local = self._find_local_visitor(id_number) if id_number else None
        if local:
            payload = self._local_visitor_payload(request, local)
            payload["gatewaySkipped"] = True
            return Response(payload)

        otp_code = request.data.get("otpCode")
        otp_consent_id = request.data.get("otpConsentId")
        credential_type = request.data.get("credentialType") or "CERTIFICATE"

        missing = []
        if not otp_code:
            missing.append("otpCode")
        if not id_number:
            missing.append("idNumber")
        if not otp_consent_id:
            missing.append("otpConsentId")
        if missing:
            return Response(
                {"Message": f"{', '.join(missing)} waa lagama maarmaan", "isError": True},
                status=400,
            )

        try:
            profile_payload = get_otp_profile(
                otp_code=str(otp_code),
                id_number=str(id_number),
                otp_consent_id=str(otp_consent_id),
                credential_type=str(credential_type),
            )
        except AccessGatewayError as e:
            return Response({"Message": str(e), "isError": True}, status=503)

        return Response(
            {
                "isError": False,
                "found": False,
                "source": "nira",
                "gateway": profile_payload,
                "localVisitor": None,
                "isReturning": False,
                "message": None,
            }
        )

    @action(detail=False, methods=["get", "post"], url_path="lookup")
    def lookup(self, request):
        """Find an existing visitor by NIRA number only (no face / photo match)."""
        nira = self._extract_nira(request)
        if not nira:
            return Response({"Message": "nira waa lagama maarmaan", "isError": True}, status=400)

        visitor = self._find_local_visitor(nira)
        if not visitor:
            return Response(
                {
                    "isError": False,
                    "found": False,
                    "source": "local",
                    "visitor": None,
                    "localVisitor": None,
                }
            )

        return Response(self._local_visitor_payload(request, visitor))
