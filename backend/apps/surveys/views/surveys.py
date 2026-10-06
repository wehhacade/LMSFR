from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response as DRFResponse

from apps.accounts.permissions import IsActiveUser
from apps.core.cache import SHORT, cache_response, invalidate_cache
from apps.surveys.models import Survey
from apps.surveys.pagination import SurveyPagination
from apps.surveys.permissions import SurveyPermission
from apps.surveys.queries import survey_detail_qs, survey_list_qs, survey_options_qs
from apps.surveys.serializers.survey import (
    SurveyDetailSerializer,
    SurveyListSerializer,
    SurveyWriteSerializer,
)
from apps.surveys.services.xlsx_import import XlsxImportError, import_xlsx_responses
from apps.surveys.views.builder import SurveyPublishMixin

SURVEY_CACHE_PATTERN = "survey"


class SurveyViewSet(SurveyPublishMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, SurveyPermission]
    pagination_class = SurveyPagination
    parser_classes = [JSONParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        if self.action == "retrieve":
            return survey_detail_qs()
        if self.action == "options":
            return survey_options_qs()
        p = self.request.query_params
        return survey_list_qs(
            search=p.get("search", "").strip(),
            status=p.get("status", "").strip(),
        )

    def get_serializer_class(self):
        if self.action in ("create", "partial_update"):
            return SurveyWriteSerializer
        if self.action == "retrieve":
            return SurveyDetailSerializer
        return SurveyListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
        invalidate_cache(SURVEY_CACHE_PATTERN)

    def perform_update(self, serializer):
        serializer.save()
        invalidate_cache(SURVEY_CACHE_PATTERN)

    def perform_destroy(self, instance):
        instance.delete()
        invalidate_cache(SURVEY_CACHE_PATTERN)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        detail = SurveyDetailSerializer(
            survey_detail_qs().get(pk=serializer.instance.pk),
            context={"request": request},
        )
        return DRFResponse(detail.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        detail = SurveyDetailSerializer(
            survey_detail_qs().get(pk=instance.pk),
            context={"request": request},
        )
        return DRFResponse(detail.data)

    @cache_response(timeout=SHORT, key_prefix="survey.stats")
    @action(detail=False, methods=["get"])
    def stats(self, request):
        today = timezone.localdate()
        # distinct=True on survey Counts: joining responses would otherwise
        # multiply rows and inflate total_surveys / status counts.
        agg = Survey.objects.aggregate(
            total_surveys=Count("id", distinct=True),
            live_surveys=Count(
                "id", filter=Q(status=Survey.Status.LIVE), distinct=True
            ),
            draft_surveys=Count(
                "id", filter=Q(status=Survey.Status.DRAFT), distinct=True
            ),
            closed_surveys=Count(
                "id", filter=Q(status=Survey.Status.CLOSED), distinct=True
            ),
            total_responses=Count("responses", distinct=True),
            today_responses=Count(
                "responses",
                filter=Q(responses__submitted_at__date=today),
                distinct=True,
            ),
        )
        return DRFResponse(agg)

    @cache_response(timeout=SHORT, key_prefix="survey.options")
    @action(detail=False, methods=["get"], url_path="options")
    def options(self, request):
        rows = list(survey_options_qs().values("id", "name")[:500])
        return DRFResponse(rows)

    @action(
        detail=True,
        methods=["post"],
        url_path="import-xlsx",
        parser_classes=[MultiPartParser],
    )
    def import_xlsx(self, request, pk=None):
        user = request.user
        if not (user.is_superuser or user.is_staff or getattr(user, "is_admin", False)):
            return DRFResponse(
                {"detail": "Admin access required to import responses."},
                status=status.HTTP_403_FORBIDDEN,
            )

        survey = self.get_object()
        upload = request.FILES.get("file")
        if not upload:
            return DRFResponse({"detail": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        dry_run = str(request.data.get("dry_run", "true")).strip().lower() != "false"

        try:
            summary = import_xlsx_responses(
                survey,
                upload,
                importing_user_id=user.id,
                filename=upload.name or "",
                dry_run=dry_run,
            )
        except XlsxImportError as exc:
            return DRFResponse({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if not dry_run:
            invalidate_cache(SURVEY_CACHE_PATTERN)

        return DRFResponse(summary)
