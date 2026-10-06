from rest_framework import serializers

from apps.personnel.models import AbsenceReason, AgentStatus, AttendanceStatus


class AgentStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentStatus
        fields = ["id", "code", "name", "name_so", "is_active_state", "sort_order"]


class AttendanceStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttendanceStatus
        fields = ["id", "code", "name", "name_so", "requires_reason", "sort_order"]


class AbsenceReasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = AbsenceReason
        fields = ["id", "code", "name", "name_so", "sort_order"]
