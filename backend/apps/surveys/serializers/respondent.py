from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.surveys.services.respondents import ACTIVE_DAYS, resolve_respondent_display_name


class SurveyRespondentLocationSerializer(serializers.Serializer):
    response_id = serializers.IntegerField()
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    sub_county_name = serializers.CharField(allow_blank=True)
    submitted_at = serializers.DateTimeField()


class SurveyRespondentMapSerializer(serializers.Serializer):
    key = serializers.CharField()
    display_name = serializers.CharField()
    phone_number = serializers.CharField(allow_blank=True)
    submission_count = serializers.IntegerField()
    district_count = serializers.IntegerField()
    districts = serializers.ListField(child=serializers.CharField())
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()
    locations = SurveyRespondentLocationSerializer(many=True)


class SurveyRespondentMapPinSerializer(serializers.Serializer):
    key = serializers.CharField()
    display_name = serializers.CharField()
    phone_number = serializers.CharField(allow_blank=True)
    submission_count = serializers.IntegerField()
    district_count = serializers.IntegerField()
    districts = serializers.ListField(child=serializers.CharField())
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class SurveyRespondentMapTrailSerializer(serializers.Serializer):
    key = serializers.CharField()
    locations = SurveyRespondentLocationSerializer(many=True)


class SurveyRespondentSerializer(serializers.Serializer):
    key = serializers.CharField(source="respondent_key")
    display_name = serializers.SerializerMethodField()
    user_id = serializers.IntegerField(allow_null=True)
    phone_number = serializers.CharField(allow_blank=True)
    guri_number = serializers.CharField(allow_blank=True)
    context_object = serializers.CharField(allow_blank=True)
    context_id = serializers.CharField(allow_blank=True)
    county_name = serializers.CharField(allow_null=True, allow_blank=True)
    sub_county_name = serializers.CharField(allow_null=True, allow_blank=True)
    submission_count = serializers.IntegerField()
    survey_count = serializers.IntegerField()
    district_count = serializers.IntegerField()
    complete_count = serializers.IntegerField()
    partial_count = serializers.IntegerField()
    last_submitted_at = serializers.DateTimeField()
    first_submitted_at = serializers.DateTimeField()
    completion_rate = serializers.SerializerMethodField()
    activity_status = serializers.SerializerMethodField()

    def get_display_name(self, obj) -> str:
        return resolve_respondent_display_name(
            display_name=obj.get("display_name") or "",
            phone_number=obj.get("phone_number") or "",
            guri_number=obj.get("guri_number") or "",
            username=obj.get("username") or "",
        )

    def get_completion_rate(self, obj) -> int:
        total = obj.get("submission_count") or 0
        complete = obj.get("complete_count") or 0
        return round((complete / total) * 100) if total else 0

    def get_activity_status(self, obj) -> str:
        last = obj.get("last_submitted_at")
        if not last:
            return "idle"
        cutoff = timezone.now() - timedelta(days=ACTIVE_DAYS)
        return "active" if last >= cutoff else "idle"


class SurveyRespondentSummarySerializer(serializers.Serializer):
    total_respondents = serializers.IntegerField()
    active_respondents = serializers.IntegerField()
    submissions_this_week = serializers.IntegerField()
    avg_completion_rate = serializers.IntegerField()
