from rest_framework import serializers

from apps.personnel.models import AgentAttendanceRecord, AgentAttendanceSession


class AgentAttendanceSessionSerializer(serializers.ModelSerializer):
    county_name = serializers.CharField(source="county.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    record_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = AgentAttendanceSession
        fields = [
            "id", "county", "county_name", "department", "department_name",
            "date", "session", "opened_by", "closed_at", "notes", "created_at", "record_count",
        ]
        read_only_fields = ["opened_by", "created_at"]


class AgentAttendanceRecordSerializer(serializers.ModelSerializer):
    agent_name = serializers.SerializerMethodField()
    agent_service_id = serializers.CharField(source="agent.service_id", read_only=True)
    agent_service_id_last4 = serializers.SerializerMethodField()
    status_name = serializers.CharField(source="status.name", read_only=True)
    status_code = serializers.CharField(source="status.code", read_only=True)
    absence_reason_name = serializers.CharField(source="absence_reason.name", read_only=True)
    absence_reason_code = serializers.CharField(source="absence_reason.code", read_only=True)
    county_name = serializers.CharField(source="county.name", read_only=True)

    class Meta:
        model = AgentAttendanceRecord
        fields = [
            "id", "session", "agent", "agent_name", "agent_service_id", "agent_service_id_last4",
            "county", "county_name", "department", "status", "status_name", "status_code",
            "absence_reason", "absence_reason_name", "absence_reason_code", "notes", "recorded_by", "recorded_at",
        ]
        read_only_fields = ["recorded_by", "recorded_at", "county", "department"]

    def get_agent_service_id_last4(self, obj):
        sid = obj.agent.service_id or ""
        return sid[-4:] if len(sid) >= 4 else sid

    def get_agent_name(self, obj):
        from apps.personnel.services.agent_presenters import agent_report_name
        return agent_report_name(obj.agent)


class AttendanceBulkRecordSerializer(serializers.Serializer):
    agent_id = serializers.IntegerField()
    status_code = serializers.CharField(max_length=40)
    absence_reason_code = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class AttendanceSessionOpenSerializer(serializers.Serializer):
    county_id = serializers.IntegerField()
    department_id = serializers.IntegerField(required=False, allow_null=True)
    date = serializers.DateField()
    session = serializers.ChoiceField(choices=AgentAttendanceSession.SessionType.choices)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class AttendanceSectionOpenSerializer(serializers.Serializer):
    department_id = serializers.IntegerField()
    county_id = serializers.IntegerField(required=False, allow_null=True)
    date = serializers.DateField()
    session = serializers.ChoiceField(choices=AgentAttendanceSession.SessionType.choices)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
