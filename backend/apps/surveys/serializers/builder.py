from rest_framework import serializers

from apps.surveys.models import Choice, Question, SurveySection


class SurveySectionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveySection
        fields = ("survey", "title", "order")


class QuestionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = (
            "section",
            "text",
            "help_text",
            "qtype",
            "required",
            "order",
            "min_value",
            "max_value",
        )

    def validate_qtype(self, value):
        valid = [c[0] for c in Question.QType.choices]
        if value not in valid:
            raise serializers.ValidationError(
                f"Invalid qtype. Must be one of: {valid}"
            )
        return value


class ChoiceWriteSerializer(serializers.ModelSerializer):
    value = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Choice
        fields = ("question", "label", "value", "order", "is_other")

    def validate(self, attrs):
        label = (attrs.get("label") or getattr(self.instance, "label", "") or "").strip()
        if "label" in attrs and not label:
            raise serializers.ValidationError({"label": "Label is required."})
        if "label" in attrs:
            attrs["label"] = label
        if "value" in attrs:
            value = (attrs.get("value") or "").strip()
            attrs["value"] = value or label
        is_other = attrs.get("is_other", getattr(self.instance, "is_other", False))
        question = attrs.get("question") or getattr(self.instance, "question", None)
        if is_other and question is not None:
            qs = Choice.objects.filter(question=question, is_other=True)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"is_other": "This question already has an Other / Wax kale choice."}
                )
        return attrs


class BulkChoiceItemSerializer(serializers.Serializer):
    label = serializers.CharField()
    value = serializers.CharField(required=False, allow_blank=True)
    is_other = serializers.BooleanField(required=False, default=False)

    def validate(self, attrs):
        label = (attrs.get("label") or "").strip()
        if not label:
            raise serializers.ValidationError({"label": "Label is required."})
        attrs["label"] = label
        value = (attrs.get("value") or "").strip()
        attrs["value"] = value or label
        attrs["is_other"] = bool(attrs.get("is_other"))
        return attrs


class BulkChoiceCreateSerializer(serializers.Serializer):
    question = serializers.IntegerField()
    labels = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True,
    )
    items = BulkChoiceItemSerializer(many=True, required=False)
    start_order = serializers.IntegerField(required=False, min_value=0)

    def validate(self, attrs):
        labels = attrs.get("labels") or []
        items = attrs.get("items") or []
        if not labels and not items:
            raise serializers.ValidationError("Provide at least one choice in 'labels' or 'items'.")
        return attrs


class QuestionReorderItemSerializer(serializers.Serializer):
    id = serializers.IntegerField(min_value=1)
    order = serializers.IntegerField(min_value=0)


class QuestionReorderSerializer(serializers.Serializer):
    """Bulk-update Question.order within one section or survey."""

    section = serializers.IntegerField(required=False, min_value=1)
    survey = serializers.IntegerField(required=False, min_value=1)
    questions = QuestionReorderItemSerializer(many=True, allow_empty=False)

    def validate(self, attrs):
        if not attrs.get("section") and not attrs.get("survey"):
            raise serializers.ValidationError(
                {"section": "Provide section or survey to scope the reorder."}
            )
        items = attrs["questions"]
        ids = [item["id"] for item in items]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError({"questions": "Duplicate question ids."})
        orders = [item["order"] for item in items]
        if len(orders) != len(set(orders)):
            raise serializers.ValidationError({"questions": "Duplicate order values."})
        return attrs
