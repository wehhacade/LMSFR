from datetime import datetime, time, timedelta

from django.db.models import Count, Min, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response as DRFResponse

from apps.accounts.permissions import IsActiveUser
from apps.core.cache import MEDIUM, cache_response
from apps.surveys.models import Response, Survey
from apps.surveys.permissions import SurveyPermission
from apps.surveys.queries import completion_breakdown_counts, completion_breakdown_items
from apps.surveys.services.analytics import (
    completion_trend,
    hourly_activity,
    period_summary,
    responses_by_district,
    top_respondents,
)


def _date_range(range_str: str) -> tuple:
    end = timezone.now().date()

    if range_str == "all":
        earliest = Response.objects.aggregate(m=Min("submitted_at"))["m"]
        start = timezone.localtime(earliest).date() if earliest else end
    else:
        days = {"7d": 7, "30d": 30, "90d": 90}.get(range_str, 90)
        start = end - timedelta(days=days - 1)

    start_dt = timezone.make_aware(datetime.combine(start, time.min))
    end_dt_exclusive = timezone.make_aware(datetime.combine(end + timedelta(days=1), time.min))
    return start, end, start_dt, end_dt_exclusive


class AnalyticsViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsActiveUser, SurveyPermission]

    def _params(self, request) -> dict:
        return {
            "range_str": request.query_params.get("range", "90d"),
            "search": (request.query_params.get("search") or "").strip(),
        }

    @cache_response(timeout=MEDIUM, key_prefix="survey.analytics.by_survey")
    @action(detail=False, methods=["get"], url_path="responses-by-survey")
    def responses_by_survey(self, request):
        range_str = request.query_params.get("range", "90d")
        _, _, start_dt, end_dt_exclusive = _date_range(range_str)
        data = list(
            Survey.objects.annotate(
                total=Count(
                    "responses",
                    filter=Q(
                        responses__submitted_at__gte=start_dt,
                        responses__submitted_at__lt=end_dt_exclusive,
                    ),
                    distinct=True,
                )
            )
            .filter(total__gt=0)
            .values("name", "total")
            .order_by("-total")[:10]
        )
        return DRFResponse(data)

    @cache_response(timeout=MEDIUM, key_prefix="survey.analytics.completion")
    @action(detail=False, methods=["get"], url_path="completion-breakdown")
    def completion_breakdown(self, request):
        range_str = request.query_params.get("range", "90d")
        _, _, start_dt, end_dt_exclusive = _date_range(range_str)

        base_qs = Response.objects.filter(
            submitted_at__gte=start_dt,
            submitted_at__lt=end_dt_exclusive,
        )
        complete, partial = completion_breakdown_counts(base_qs)
        return DRFResponse(completion_breakdown_items(complete, partial))

    @cache_response(timeout=MEDIUM, key_prefix="survey.analytics.daily_trend")
    @action(detail=False, methods=["get"], url_path="daily-trend")
    def daily_trend(self, request):
        range_str = request.query_params.get("range", "90d")
        start, end, start_dt, end_dt_exclusive = _date_range(range_str)

        qs = (
            Response.objects.filter(
                submitted_at__gte=start_dt,
                submitted_at__lt=end_dt_exclusive,
            )
            .annotate(day=TruncDate("submitted_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        counts_by_day = {str(row["day"]): row["count"] for row in qs}

        days_count = (end - start).days + 1
        series = []
        for i in range(days_count):
            day = start + timedelta(days=i)
            day_str = day.strftime("%Y-%m-%d")
            series.append({
                "label": day.strftime("%a")[0],
                "date": day_str,
                "count": counts_by_day.get(day_str, 0),
            })
        return DRFResponse(series)

    @cache_response(timeout=MEDIUM, key_prefix="survey.analytics.period_summary")
    @action(detail=False, methods=["get"], url_path="period-summary")
    def period_summary_view(self, request):
        params = self._params(request)
        return DRFResponse(period_summary(**params))

    @cache_response(timeout=MEDIUM, key_prefix="survey.analytics.hourly")
    @action(detail=False, methods=["get"], url_path="hourly-activity")
    def hourly_activity_view(self, request):
        params = self._params(request)
        return DRFResponse(hourly_activity(**params))

    @cache_response(timeout=MEDIUM, key_prefix="survey.analytics.district")
    @action(detail=False, methods=["get"], url_path="by-district")
    def by_district(self, request):
        params = self._params(request)
        return DRFResponse(responses_by_district(**params))

    @cache_response(timeout=MEDIUM, key_prefix="survey.analytics.completion_trend")
    @action(detail=False, methods=["get"], url_path="completion-trend")
    def completion_trend_view(self, request):
        params = self._params(request)
        return DRFResponse(completion_trend(**params))

    @cache_response(timeout=MEDIUM, key_prefix="survey.analytics.top_respondents")
    @action(detail=False, methods=["get"], url_path="top-respondents")
    def top_respondents_view(self, request):
        params = self._params(request)
        return DRFResponse(top_respondents(**params))
