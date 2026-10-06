from rest_framework import serializers

from apps.personnel.models import AgentAssignmentHistory, AgentStatusHistory


class AgentAssignmentHistorySerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.personal_fullname", read_only=True)
    agent_service_id = serializers.CharField(source="agent.service_id", read_only=True)
    from_county_name = serializers.CharField(source="from_county.name", read_only=True)
    to_county_name = serializers.CharField(source="to_county.name", read_only=True)
    from_department_name = serializers.CharField(source="from_department.name", read_only=True)
    to_department_name = serializers.CharField(source="to_department.name", read_only=True)
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AgentAssignmentHistory
        fields = [
            "id", "agent", "agent_name", "agent_service_id",
            "from_county", "from_county_name", "to_county", "to_county_name",
            "from_department", "from_department_name", "to_department", "to_department_name",
            "reason", "transfer_date", "notes", "performed_by", "performed_by_name", "created_at",
        ]
        read_only_fields = ["created_at", "performed_by"]

    def get_performed_by_name(self, obj):
        if obj.performed_by_id:
            return obj.performed_by.get_full_name() or obj.performed_by.email
        return None


class AgentTransferCreateSerializer(serializers.Serializer):
    agent_id = serializers.IntegerField()
    to_county_id = serializers.IntegerField()
    to_department_id = serializers.IntegerField(required=False, allow_null=True)
    reason = serializers.CharField(max_length=500)
    transfer_date = serializers.DateField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class AgentStatusHistorySerializer(serializers.ModelSerializer):
    old_status_name = serializers.CharField(source="old_status.name", read_only=True)
    new_status_name = serializers.CharField(source="new_status.name", read_only=True)

    class Meta:
        model = AgentStatusHistory
        fields = [
            "id", "agent", "old_status", "old_status_name",
            "new_status", "new_status_name", "reason", "notes", "changed_by", "created_at",
        ]
