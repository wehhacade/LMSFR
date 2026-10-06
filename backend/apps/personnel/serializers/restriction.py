from rest_framework import serializers

from apps.personnel.models import AgentRestriction, AgentRestrictionAction


class AgentRestrictionSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.personal_fullname", read_only=True)
    agent_service_id = serializers.CharField(source="agent.service_id", read_only=True)

    class Meta:
        model = AgentRestriction
        fields = [
            "id", "agent", "agent_name", "agent_service_id",
            "reason", "start_date", "end_date",
            "id_card_status", "weapon_status", "status", "notes",
            "created_by", "released_by", "released_at", "created_at", "updated_at",
        ]
        read_only_fields = ["created_by", "released_by", "released_at", "created_at", "updated_at", "status"]


class AgentRestrictionCreateSerializer(serializers.Serializer):
    agent_id = serializers.IntegerField()
    reason = serializers.CharField(max_length=500)
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    id_card_withheld = serializers.BooleanField(default=True)
    weapon_withheld = serializers.BooleanField(default=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class AgentRestrictionExtendSerializer(serializers.Serializer):
    new_end_date = serializers.DateField()
    new_reason = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class AgentRestrictionActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentRestrictionAction
        fields = ["id", "restriction", "action", "new_end_date", "new_reason", "notes", "performed_by", "created_at"]
