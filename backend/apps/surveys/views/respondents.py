from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response as DRFResponse

from apps.accounts.permissions import IsActiveUser
from apps.surveys.pagination import ResponsePagination
from apps.surveys.permissions import ResponsePermission
from apps.surveys.serializers.respondent import (
    SurveyRespondentMapPinSerializer,
    SurveyRespondentMapSerializer,
    SurveyRespondentMapTrailSerializer,
    SurveyRespondentSerializer,
    SurveyRespondentSummarySerializer,
)
from apps.surveys.serializers.response import ResponseListSerializer
from apps.surveys.queries import annotate_list_completion, response_list_filter_qs
from apps.surveys.services.respondents import (
    filter_responses_by_key,
    parse_respondent_key,
    respondent_detail,
    respondent_map_trail_data,
    respondents_grouped_qs,
    respondents_map_data,
    respondents_summary,
)


class RespondentViewSet(viewsets.ViewSet):
    """Survey respondents — grouped submitters and their activity."""

    permission_classes = [IsAuthenticated, IsActiveUser, ResponsePermission]
    pagination_class = ResponsePagination
    lookup_value_regex = "[^/]+"

    def _params(self, request) -> dict:
        p = request.query_params
        return {
            "survey_id": p.get("survey", "").strip(),
            "search": p.get("search", "").strip(),
            "date_from": p.get("date_from", "").strip(),
            "date_to": p.get("date_to", "").strip(),
            "activity_status": p.get("activity_status", "").strip(),
        }

    def list(self, request):
        qs = respondents_grouped_qs(**self._params(request))
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request, view=self)
        serializer = SurveyRespondentSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        params = self._params(request)
        params.pop("activity_status", None)
        data = respondents_summary(**params)
        return DRFResponse(SurveyRespondentSummarySerializer(data).data)

    @action(detail=False, methods=["get"], url_path="map")
    def map(self, request):
        rows = respondents_map_data(**self._params(request), include_locations=False)
        serializer = SurveyRespondentMapPinSerializer(rows, many=True)
        return DRFResponse(serializer.data)

    @action(detail=True, methods=["get"], url_path="map-trail")
    def map_trail(self, request, pk=None):
        try:
            parse_respondent_key(pk)
        except (ValueError, TypeError):
            return DRFResponse({"detail": "Invalid respondent key."}, status=status.HTTP_404_NOT_FOUND)
        row = respondent_map_trail_data(respondent_key=pk, **self._params(request))
        serializer = SurveyRespondentMapTrailSerializer(row)
        return DRFResponse(serializer.data)

    def retrieve(self, request, pk=None):
        try:
            parse_respondent_key(pk)
        except (ValueError, TypeError):
            return DRFResponse({"detail": "Invalid respondent key."}, status=status.HTTP_404_NOT_FOUND)

        row = respondent_detail(pk)
        if not row:
            return DRFResponse({"detail": "Respondent not found."}, status=status.HTTP_404_NOT_FOUND)
        return DRFResponse(SurveyRespondentSerializer(row).data)

    def get_response_list_count(self) -> int:
        return getattr(self, "_activity_count", 0)

    @action(detail=True, methods=["get"])
    def activity(self, request, pk=None):
        try:
            parse_respondent_key(pk)
        except (ValueError, TypeError):
            return DRFResponse({"detail": "Invalid respondent key."}, status=status.HTTP_404_NOT_FOUND)

        p = request.query_params
        base = filter_responses_by_key(
            response_list_filter_qs(
                survey_id=p.get("survey", "").strip(),
                date_from=p.get("date_from", "").strip(),
                date_to=p.get("date_to", "").strip(),
            ),
            pk,
        )
        # Fast COUNT on filtered rows (no per-row completion subqueries).
        self._activity_count = base.count()
        qs = annotate_list_completion(base)
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(qs, request, view=self)
        serializer = ResponseListSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)
