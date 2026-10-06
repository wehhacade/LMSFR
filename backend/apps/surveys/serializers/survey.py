from rest_framework import serializers

from apps.surveys.models import Choice, Question, Survey, SurveySection


class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ("id", "label", "value", "order", "is_other")


class QuestionSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)
    # Alias for mobile clients (e.g. Dart, where `required` is a reserved word).
    is_required = serializers.BooleanField(source="required", read_only=True)

    class Meta:
        model = Question
        fields = (
            "id", "text", "help_text", "qtype", "required", "is_required",
            "order", "min_value", "max_value", "choices",
        )


class SurveySectionSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = SurveySection
        fields = ("id", "title", "order", "questions")


class SurveyListSerializer(serializers.ModelSerializer):
    response_count = serializers.IntegerField(read_only=True, default=0)
    section_count = serializers.IntegerField(read_only=True, default=0)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Survey
        fields = (
            "id",
            "name",
            "description",
            "status",
            "allow_multiple_submissions",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
            "response_count",
            "section_count",
        )

    def get_created_by_name(self, obj) -> str | None:
        if not obj.created_by:
            return None
        return obj.created_by.get_full_name() or obj.created_by.username


class SurveyDetailSerializer(serializers.ModelSerializer):
    sections = SurveySectionSerializer(many=True, read_only=True)
    response_count = serializers.IntegerField(read_only=True, default=0)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Survey
        fields = (
            "id",
            "name",
            "description",
            "status",
            "allow_multiple_submissions",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
            "response_count",
            "sections",
        )

    def get_created_by_name(self, obj) -> str | None:
        if not obj.created_by:
            return None
        return obj.created_by.get_full_name() or obj.created_by.username


class SurveyWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Survey
        fields = (
            "name",
            "description",
            "status",
            "allow_multiple_submissions",
        )
