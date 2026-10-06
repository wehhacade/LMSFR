from rest_framework import serializers

from apps.personnel.models import AgentImportBatch, AgentImportRow


class AgentImportBatchSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AgentImportBatch
        fields = [
            "id", "filename", "source_section", "status", "summary",
            "uploaded_by", "uploaded_by_name", "applied_at", "created_at",
        ]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by_id:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.email
        return None


class AgentImportRowSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentImportRow
        fields = [
            "id", "batch", "row_number", "service_id", "agent_name",
            "action", "validation_errors", "diff", "agent", "created_at",
        ]
