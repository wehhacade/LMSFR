from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.audit.models import APITrafficLog, AuditTrail, ErrorLog

User = get_user_model()


class AuditUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "username", "full_name")

    def get_full_name(self, obj) -> str:
        return obj.get_full_name() or obj.email


class AuditTrailSerializer(serializers.ModelSerializer):
    user = AuditUserSerializer(read_only=True)

    class Meta:
        model = AuditTrail
        fields = (
            "id",
            "user",
            "event_type",
            "action",
            "submodule",
            "module",
            "page",
            "click_target",
            "entity_type",
            "entity_id",
            "details",
            "ip_address",
            "operating_system",
            "browser",
            "network",
            "path",
            "method",
            "created_at",
        )
        read_only_fields = fields


class AuditTrailCreateSerializer(serializers.Serializer):
    action = serializers.CharField(max_length=2000)
    event_type = serializers.ChoiceField(choices=AuditTrail.EventType.choices, default=AuditTrail.EventType.OTHER)
    submodule = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    module = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    page = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    click_target = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    entity_type = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    entity_id = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    details = serializers.JSONField(required=False, default=dict)
    path = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")

    def create(self, validated_data):
        request = self.context["request"]
        from apps.audit.services import AuditService

        path = validated_data.pop("path", "")
        AuditService.log(
            request=request,
            user=request.user,
            async_write=True,
            path=path,
            **validated_data,
        )
        return AuditTrail.objects.filter(user=request.user).order_by("-created_at").first()


class ErrorLogListSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True, default=None)

    class Meta:
        model = ErrorLog
        fields = (
            "id",
            "user_email",
            "expected_error",
            "field_error",
            "line_number",
            "ip_address",
            "path",
            "method",
            "status_code",
            "created_at",
        )


class ErrorLogDetailSerializer(ErrorLogListSerializer):
    class Meta(ErrorLogListSerializer.Meta):
        fields = ErrorLogListSerializer.Meta.fields + ("trace_back", "user_agent")


class APITrafficSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True, default=None)

    class Meta:
        model = APITrafficLog
        fields = (
            "id",
            "user_email",
            "method",
            "path",
            "status_code",
            "duration_ms",
            "ip_address",
            "created_at",
        )


class AuditStatsSerializer(serializers.Serializer):
    audits_today = serializers.IntegerField()
    errors_today = serializers.IntegerField()
    traffic_today = serializers.IntegerField()
    total_audits = serializers.IntegerField()
