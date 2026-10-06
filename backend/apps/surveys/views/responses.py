from django.db.models import Count, Prefetch, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response as DRFResponse

from apps.accounts.permissions import IsActiveUser
from apps.core.cache import invalidate_cache
from apps.surveys.models import Answer, Response
from apps.surveys.pagination import ResponsePagination, SurveyPagination
from apps.surveys.permissions import ResponsePermission
from apps.surveys.queries import apply_deadline_status_filter, response_list_qs
from apps.surveys.services.response_completion import count_responses_with_completion
from apps.surveys.serializers.response import (
    CAMERA_QUESTION_TEXT,
    OWNER_QUESTION_TEXT,
    OwnerAnswerSerializer,
    ResponseDetailSerializer,
    ResponseListSerializer,
    ResponseWriteSerializer,
)

SURVEY_CACHE_PATTERN = "survey"


def _camera_answer_q(value: str) -> Q:
    return (
        Q(response__answers__question__text__iexact=CAMERA_QUESTION_TEXT)
        & (
            Q(response__answers__choices__label__iexact=value)
            | Q(response__answers__choices__value__iexact=value)
            | Q(response__answers__value_text__iexact=value)
        )
    )


def _owner_camera_summary(owners) -> dict:
    total = owners.count()
    haa = owners.filter(_camera_answer_q("haa")).distinct().count()
    maya = owners.filter(_camera_answer_q("maya")).distinct().count()
    return {
        "total": total,
        "haa": haa,
        "maya": maya,
        "unknown": max(0, total - haa - maya),
    }


class ResponseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, ResponsePermission]
    pagination_class = ResponsePagination
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        if self.action == "retrieve":
            return self._detail_qs()
        p = self.request.query_params
        return response_list_qs(
            survey_id=p.get("survey", "").strip(),
            search=p.get("search", "").strip(),
            date_from=p.get("date_from", "").strip(),
            date_to=p.get("date_to", "").strip(),
            completion_status=p.get("completion_status", "").strip(),
            county_id=p.get("county", "").strip(),
            deadline_status=p.get("deadline", "").strip(),
        )

    def get_response_list_count(self) -> int:
        p = self.request.query_params
        return count_responses_with_completion(
            survey_id=p.get("survey", "").strip(),
            search=p.get("search", "").strip(),
            date_from=p.get("date_from", "").strip(),
            date_to=p.get("date_to", "").strip(),
            completion_status=p.get("completion_status", "").strip(),
            county_id=p.get("county", "").strip(),
            deadline_status=p.get("deadline", "").strip(),
        )

    def get_serializer_class(self):
        if self.action in ("create", "partial_update"):
            return ResponseWriteSerializer
        if self.action == "retrieve":
            return ResponseDetailSerializer
        return ResponseListSerializer

    def perform_create(self, serializer):
        extra = {}
        user = self.request.user
        if user.is_authenticated and not serializer.validated_data.get("user"):
            extra["user"] = user
        serializer.save(**extra)
        invalidate_cache(SURVEY_CACHE_PATTERN)

    def perform_update(self, serializer):
        serializer.save()
        invalidate_cache(SURVEY_CACHE_PATTERN)

    def perform_destroy(self, instance):
        instance.delete()
        invalidate_cache(SURVEY_CACHE_PATTERN)

    def _detail_qs(self):
        # answer_count/total_questions: informational, all questions on the survey.
        # required_answer_count/required_total_questions: drives the actual
        # complete/partial status — an optional question added later shouldn't
        # retroactively mark old responses as incomplete.
        return (
            Response.objects.select_related("survey", "user", "county", "sub_county")
            .annotate(
                answer_count=Count("answers", distinct=True),
                total_questions=Count("survey__sections__questions", distinct=True),
                required_answer_count=Count(
                    "answers", filter=Q(answers__question__required=True), distinct=True
                ),
                required_total_questions=Count(
                    "survey__sections__questions",
                    filter=Q(survey__sections__questions__required=True),
                    distinct=True,
                ),
            )
            .prefetch_related("answers__question", "answers__choices")
        )

    @action(detail=False, methods=["get"], pagination_class=SurveyPagination)
    def owners(self, request):
        p = request.query_params
        camera_answers = Prefetch(
            "response__answers",
            queryset=(
                Answer.objects.filter(question__text__iexact=CAMERA_QUESTION_TEXT)
                .prefetch_related("choices")
            ),
            to_attr="_camera_answers",
        )
        owners = (
            Answer.objects.filter(question__text__iexact=OWNER_QUESTION_TEXT)
            .exclude(value_text="")
            .select_related(
                "response__survey",
                "response__user",
                "response__county",
                "response__sub_county",
            )
            .prefetch_related(camera_answers)
            .order_by("-response__submitted_at", "-id")
        )
        survey_id = p.get("survey", "").strip()
        if survey_id:
            try:
                owners = owners.filter(response__survey_id=int(survey_id))
            except ValueError:
                owners = owners.none()
        search = p.get("search", "").strip()
        if search:
            owners = owners.filter(
                Q(value_text__icontains=search)
                | Q(response__phone_number__icontains=search)
                | Q(response__guri_number__icontains=search)
                | Q(response__survey__name__icontains=search)
                | Q(response__county__name__icontains=search)
                | Q(response__sub_county__name__icontains=search)
            )
        county = p.get("county", "").strip()
        county_id = None
        county_name = None
        if county:
            from apps.accounts.models import County

            if county.isdigit():
                county_id = int(county)
                owners = owners.filter(response__county_id=county_id)
                county_name = County.objects.filter(pk=county_id).values_list("name", flat=True).first()
            else:
                county_name = county
                owners = owners.filter(response__county__name__iexact=county)
                county_id = (
                    County.objects.filter(name__iexact=county).values_list("id", flat=True).first()
                )

        summary = _owner_camera_summary(owners)
        summary["county_id"] = county_id
        summary["county_name"] = county_name

        camera = p.get("camera", "").strip().lower()
        if camera in ("haa", "maya"):
            owners = owners.filter(_camera_answer_q(camera)).distinct()

        deadline = p.get("deadline", "").strip()
        if deadline:
            owners = apply_deadline_status_filter(owners, deadline, prefix="response__")

        page = self.paginate_queryset(owners)
        serializer = OwnerAnswerSerializer(page, many=True)
        payload = self.get_paginated_response(serializer.data)
        payload.data["summary"] = summary
        return payload

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output = ResponseDetailSerializer(
            self._detail_qs().get(pk=serializer.instance.pk),
            context={"request": request},
        )
        return DRFResponse(output.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        output = ResponseDetailSerializer(
            self._detail_qs().get(pk=instance.pk),
            context={"request": request},
        )
        return DRFResponse(output.data)
