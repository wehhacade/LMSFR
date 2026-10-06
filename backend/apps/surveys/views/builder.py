from django.db import transaction
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response as DRFResponse

from apps.accounts.permissions import IsActiveUser
from apps.core.cache import invalidate_cache
from apps.surveys.models import Choice, Question, Survey, SurveySection
from apps.surveys.permissions import SurveyPermission
from apps.surveys.queries import survey_detail_qs
from apps.surveys.serializers.builder import (
    BulkChoiceCreateSerializer,
    ChoiceWriteSerializer,
    QuestionReorderSerializer,
    QuestionWriteSerializer,
    SurveySectionWriteSerializer,
)
from apps.surveys.serializers.survey import (
    ChoiceSerializer,
    QuestionSerializer,
    SurveyDetailSerializer,
    SurveySectionSerializer,
)

SURVEY_CACHE_PATTERN = "survey"

CHOICE_QTYPES = {"single", "multi"}


class SurveySectionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, SurveyPermission]
    parser_classes = [JSONParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = (
            SurveySection.objects.select_related("survey")
            .prefetch_related("questions__choices")
            .order_by("order", "id")
        )
        survey_id = self.request.query_params.get("survey")
        if survey_id:
            qs = qs.filter(survey_id=survey_id)
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "partial_update"):
            return SurveySectionWriteSerializer
        return SurveySectionSerializer

    def _read(self, pk):
        return SurveySectionSerializer(
            SurveySection.objects.prefetch_related("questions__choices").get(pk=pk)
        ).data

    def perform_create(self, serializer):
        serializer.save()
        invalidate_cache(SURVEY_CACHE_PATTERN)

    def perform_update(self, serializer):
        serializer.save()
        invalidate_cache(SURVEY_CACHE_PATTERN)

    def perform_destroy(self, instance):
        instance.delete()
        invalidate_cache(SURVEY_CACHE_PATTERN)

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        self.perform_create(s)
        return DRFResponse(self._read(s.instance.pk), status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        s = self.get_serializer(instance, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        self.perform_update(s)
        return DRFResponse(self._read(instance.pk))


class QuestionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, SurveyPermission]
    parser_classes = [JSONParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = (
            Question.objects.select_related("section__survey")
            .prefetch_related("choices")
            .order_by("order", "id")
        )
        section_id = self.request.query_params.get("section")
        if section_id:
            qs = qs.filter(section_id=section_id)
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "partial_update"):
            return QuestionWriteSerializer
        return QuestionSerializer

    def _read(self, pk):
        return QuestionSerializer(
            Question.objects.prefetch_related("choices").get(pk=pk)
        ).data

    def perform_create(self, serializer):
        serializer.save()
        invalidate_cache(SURVEY_CACHE_PATTERN)

    def perform_update(self, serializer):
        serializer.save()
        invalidate_cache(SURVEY_CACHE_PATTERN)

    def perform_destroy(self, instance):
        instance.delete()
        invalidate_cache(SURVEY_CACHE_PATTERN)

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        self.perform_create(s)
        return DRFResponse(self._read(s.instance.pk), status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        s = self.get_serializer(instance, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        self.perform_update(s)
        return DRFResponse(self._read(instance.pk))

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        payload = QuestionReorderSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        items = data["questions"]
        ids = [item["id"] for item in items]

        qs = Question.objects.select_related("section__survey").filter(id__in=ids)
        if data.get("section"):
            qs = qs.filter(section_id=data["section"])
        if data.get("survey"):
            qs = qs.filter(section__survey_id=data["survey"])

        found = {q.id: q for q in qs}
        missing = [qid for qid in ids if qid not in found]
        if missing:
            raise serializers.ValidationError(
                {"questions": f"Unknown or out-of-scope question ids: {missing}"}
            )

        with transaction.atomic():
            for item in items:
                Question.objects.filter(pk=item["id"]).update(order=item["order"])

        invalidate_cache(SURVEY_CACHE_PATTERN)
        ordered = (
            Question.objects.filter(id__in=ids)
            .prefetch_related("choices")
            .order_by("order", "id")
        )
        return DRFResponse(QuestionSerializer(ordered, many=True).data)


class ChoiceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, SurveyPermission]
    parser_classes = [JSONParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = (
            Choice.objects.select_related("question__section__survey")
            .order_by("order", "id")
        )
        question_id = self.request.query_params.get("question")
        if question_id:
            qs = qs.filter(question_id=question_id)
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "partial_update"):
            return ChoiceWriteSerializer
        return ChoiceSerializer

    def perform_create(self, serializer):
        serializer.save()
        invalidate_cache(SURVEY_CACHE_PATTERN)

    def perform_update(self, serializer):
        serializer.save()
        invalidate_cache(SURVEY_CACHE_PATTERN)

    def perform_destroy(self, instance):
        instance.delete()
        invalidate_cache(SURVEY_CACHE_PATTERN)

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        payload = BulkChoiceCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        question_id = payload.validated_data["question"]
        question = Question.objects.filter(pk=question_id).first()
        if not question:
            raise serializers.ValidationError({"question": "Question not found."})

        labels = payload.validated_data.get("labels") or []
        items = payload.validated_data.get("items") or []

        normalized_items = []
        if labels:
            normalized_items.extend([{"label": lbl} for lbl in labels if str(lbl).strip()])
        if items:
            normalized_items.extend(items)

        if not normalized_items:
            raise serializers.ValidationError({"labels": "No valid choice labels provided."})

        start_order = payload.validated_data.get("start_order")
        if start_order is None:
            start_order = question.choices.count()

        to_create = [
            Choice(
                question=question,
                label=(label := (item.get("label") or "").strip()),
                value=(item.get("value") or "").strip() or label,
                order=start_order + idx,
                is_other=bool(item.get("is_other")),
            )
            for idx, item in enumerate(normalized_items)
            if (item.get("label") or "").strip()
        ]

        with transaction.atomic():
            created = Choice.objects.bulk_create(to_create)

        invalidate_cache(SURVEY_CACHE_PATTERN)
        return DRFResponse(ChoiceSerializer(created, many=True).data, status=status.HTTP_201_CREATED)


def _validate_for_publish(survey: Survey) -> list[str]:
    errors = []
    sections = list(
        SurveySection.objects.filter(survey=survey)
        .prefetch_related("questions__choices")
        .order_by("order", "id")
    )
    if not sections:
        errors.append("Survey must have at least one section.")
        return errors

    for section in sections:
        questions = list(section.questions.all())
        if not questions:
            label = section.title or f"Section {section.order + 1}"
            errors.append(f"'{label}' has no questions.")
            continue
        for q in questions:
            if q.qtype in CHOICE_QTYPES:
                choice_count = q.choices.count()
                if choice_count < 2:
                    errors.append(
                        f"Question '{q.text[:50]}' ({q.qtype}) needs at least 2 choices "
                        f"(has {choice_count})."
                    )
    return errors


class SurveyPublishMixin:
    """Publish action — mixed into SurveyViewSet."""

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        survey = self.get_object()

        if survey.status == Survey.Status.LIVE:
            return DRFResponse({"detail": "Survey is already live."}, status=status.HTTP_400_BAD_REQUEST)

        errors = _validate_for_publish(survey)
        if errors:
            return DRFResponse({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        survey.status = Survey.Status.LIVE
        survey.save(update_fields=["status", "updated_at"])
        invalidate_cache(SURVEY_CACHE_PATTERN)

        return DRFResponse(
            SurveyDetailSerializer(
                survey_detail_qs().get(pk=survey.pk),
                context={"request": request},
            ).data
        )
