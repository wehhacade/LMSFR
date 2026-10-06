import json
from datetime import timedelta

from rest_framework import serializers

from apps.suspects.photo_utils import resolve_photo_url
from apps.surveys.models import Answer, Choice, Question, Response, Survey
from apps.surveys.queries import deadline_days_remaining

CHOICE_QTYPES = {Question.QType.SINGLE, Question.QType.MULTI}
NUMERIC_QTYPES = {Question.QType.INT, Question.QType.DEC, Question.QType.RATING}


def _file_url(request, file_field) -> str | None:
    if not file_field or not getattr(file_field, "name", None):
        return None
    url = resolve_photo_url(file_field.name, request)
    return url or None


def _answer_is_filled(question: Question, answer_data: dict) -> bool:
    qtype = question.qtype
    if qtype in CHOICE_QTYPES:
        choices = answer_data.get("choices") or []
        if not choices:
            return False
        if any(getattr(choice, "is_other", False) for choice in choices):
            return bool((answer_data.get("value_text") or "").strip())
        return True
    if qtype in {Question.QType.SHORT, Question.QType.LONG}:
        return bool((answer_data.get("value_text") or "").strip())
    if qtype in NUMERIC_QTYPES:
        return answer_data.get("value_number") is not None
    if qtype == Question.QType.DATE:
        return answer_data.get("value_date") is not None
    if qtype == Question.QType.BOOL:
        return answer_data.get("value_bool") is not None
    return False


def _completion_status(answer_count: int, total_questions: int) -> str:
    if total_questions > 0 and answer_count >= total_questions:
        return "complete"
    return "partial"


class ChoiceSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ("id", "label", "value", "is_other")


class AnswerSerializer(serializers.ModelSerializer):
    choices = ChoiceSummarySerializer(many=True, read_only=True)
    question_text = serializers.CharField(source="question.text", read_only=True)
    question_type = serializers.CharField(source="question.qtype", read_only=True)

    class Meta:
        model = Answer
        fields = (
            "id",
            "question",
            "question_text",
            "question_type",
            "value_text",
            "value_number",
            "value_bool",
            "value_date",
            "choices",
        )


OWNER_QUESTION_TEXT = "MAGACA MILKILAHA"
CAMERA_QUESTION_TEXT = "KAAMIRO MA XIRAN TAHAY"


class OwnerAnswerSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source="value_text", read_only=True)
    camera_installed = serializers.SerializerMethodField()
    survey = serializers.IntegerField(source="response.survey_id", read_only=True)
    survey_name = serializers.CharField(source="response.survey.name", read_only=True)
    phone_number = serializers.CharField(source="response.phone_number", read_only=True)
    guri_number = serializers.CharField(source="response.guri_number", read_only=True)
    county_name = serializers.CharField(source="response.county.name", read_only=True, default=None)
    sub_county_name = serializers.CharField(source="response.sub_county.name", read_only=True, default=None)
    submitted_at = serializers.DateTimeField(source="response.submitted_at", read_only=True)
    deadline_at = serializers.SerializerMethodField()
    is_deadline_expired = serializers.SerializerMethodField()
    deadline_days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = Answer
        fields = (
            "id",
            "response",
            "owner_name",
            "camera_installed",
            "survey",
            "survey_name",
            "phone_number",
            "guri_number",
            "county_name",
            "sub_county_name",
            "submitted_at",
            "deadline_at",
            "is_deadline_expired",
            "deadline_days_remaining",
        )

    def get_camera_installed(self, obj) -> str | None:
        camera_answers = getattr(obj.response, "_camera_answers", None)
        if camera_answers is None:
            camera_answers = list(
                Answer.objects.filter(
                    response_id=obj.response_id,
                    question__text__iexact=CAMERA_QUESTION_TEXT,
                ).prefetch_related("choices")
            )
        if not camera_answers:
            return None
        answer = camera_answers[0]
        choices = list(answer.choices.all())
        if choices:
            return ", ".join(choice.label for choice in choices)
        if answer.value_text:
            return answer.value_text
        if answer.value_bool is not None:
            return "Haa" if answer.value_bool else "Maya"
        return None

    def get_deadline_at(self, obj):
        deadline = obj.response.deadline_at
        return deadline.isoformat() if deadline else None

    def get_is_deadline_expired(self, obj) -> bool:
        return bool(obj.response.is_deadline_expired)

    def get_deadline_days_remaining(self, obj) -> int | None:
        return deadline_days_remaining(obj.response.deadline_at)


class ResponseListSerializer(serializers.ModelSerializer):
    survey_name = serializers.CharField(source="survey.name", read_only=True)
    user_name = serializers.SerializerMethodField()
    respondent_phone = serializers.SerializerMethodField()
    county_name = serializers.CharField(source="county.name", read_only=True, default=None)
    sub_county_name = serializers.CharField(source="sub_county.name", read_only=True, default=None)
    answer_count = serializers.SerializerMethodField()
    total_questions = serializers.SerializerMethodField()
    completion_status = serializers.SerializerMethodField()
    navigation_url = serializers.SerializerMethodField()
    deadline_at = serializers.SerializerMethodField()
    is_deadline_expired = serializers.SerializerMethodField()
    deadline_days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = Response
        fields = (
            "id",
            "survey",
            "survey_name",
            "user",
            "user_name",
            "respondent_phone",
            "county",
            "county_name",
            "sub_county",
            "sub_county_name",
            "guri_number",
            "phone_number",
            "submitted_at",
            "deadline_duration",
            "deadline_at",
            "is_deadline_expired",
            "deadline_days_remaining",
            "context_object",
            "context_id",
            "latitude",
            "longitude",
            "answer_count",
            "total_questions",
            "completion_status",
            "navigation_url",
        )

    def get_user_name(self, obj) -> str | None:
        if not obj.user:
            return None
        return obj.user.get_full_name() or obj.user.username

    def get_respondent_phone(self, obj) -> str:
        if obj.user and obj.user.phone:
            return obj.user.phone
        return obj.phone_number

    def _answer_count(self, obj) -> int:
        """Informational: how many of ALL questions on the survey were answered."""
        if hasattr(obj, "answer_count") and obj.answer_count is not None:
            return obj.answer_count
        return obj.answers.count()

    def _total_questions(self, obj) -> int:
        if hasattr(obj, "total_questions") and obj.total_questions is not None:
            return obj.total_questions
        return Question.objects.filter(section__survey_id=obj.survey_id).count()

    def get_answer_count(self, obj) -> int:
        return self._answer_count(obj)

    def get_total_questions(self, obj) -> int:
        return self._total_questions(obj)

    def _required_answer_count(self, obj) -> int:
        if hasattr(obj, "required_answer_count") and obj.required_answer_count is not None:
            return obj.required_answer_count
        return obj.answers.filter(question__required=True).count()

    def _required_total_questions(self, obj) -> int:
        if hasattr(obj, "required_total_questions") and obj.required_total_questions is not None:
            return obj.required_total_questions
        return Question.objects.filter(section__survey_id=obj.survey_id, required=True).count()

    def get_completion_status(self, obj) -> str:
        # Deliberately NOT answer_count/total_questions above (all questions,
        # informational only) — completion tracks required questions only, so
        # an optional question added later doesn't retroactively mark old
        # responses as incomplete.
        return _completion_status(self._required_answer_count(obj), self._required_total_questions(obj))

    def get_navigation_url(self, obj) -> str:
        return obj.navigation_url

    def get_deadline_at(self, obj):
        deadline = obj.deadline_at
        return deadline.isoformat() if deadline else None

    def get_is_deadline_expired(self, obj) -> bool:
        return bool(obj.is_deadline_expired)

    def get_deadline_days_remaining(self, obj) -> int | None:
        return deadline_days_remaining(obj.deadline_at)


class ResponseDetailSerializer(ResponseListSerializer):
    answers = AnswerSerializer(many=True, read_only=True)
    identity_file = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()
    sawirka_guriga = serializers.SerializerMethodField()
    documentiga_guriga = serializers.SerializerMethodField()

    class Meta(ResponseListSerializer.Meta):
        fields = ResponseListSerializer.Meta.fields + (
            "answers",
            "identity_file",
            "photo",
            "sawirka_guriga",
            "documentiga_guriga",
        )

    def get_identity_file(self, obj) -> str | None:
        return _file_url(self.context.get("request"), obj.identity_file)

    def get_photo(self, obj) -> str | None:
        return _file_url(self.context.get("request"), obj.photo)

    def get_sawirka_guriga(self, obj) -> str | None:
        return _file_url(self.context.get("request"), obj.sawirka_guriga)

    def get_documentiga_guriga(self, obj) -> str | None:
        return _file_url(self.context.get("request"), obj.documentiga_guriga)

class AnswerWriteSerializer(serializers.ModelSerializer):
    choice_ids = serializers.PrimaryKeyRelatedField(
        source="choices",
        queryset=Choice.objects.all(),
        many=True,
        required=False,
    )

    class Meta:
        model = Answer
        fields = (
            "question",
            "value_text",
            "value_number",
            "value_bool",
            "value_date",
            "choice_ids",
        )


class ResponseWriteSerializer(serializers.ModelSerializer):
    answers = AnswerWriteSerializer(many=True, required=False, write_only=True)

    class Meta:
        model = Response
        fields = (
            "survey",
            "user",
            "county",
            "sub_county",
            "guri_number",
            "phone_number",
            "deadline_duration",
            "latitude",
            "longitude",
            "identity_file",
            "photo",
            "sawirka_guriga",
            "documentiga_guriga",
            "context_object",
            "context_id",
            "answers",
        )

    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            # QueryDict.copy() deep-copies file uploads and raises TypeError.
            parsed = {key: data.get(key) for key in data.keys()}
        elif hasattr(data, "copy"):
            parsed = data.copy()
        else:
            parsed = dict(data)

        answers = parsed.get("answers")
        if isinstance(answers, str) and answers.strip():
            try:
                parsed["answers"] = json.loads(answers)
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError(
                    {"answers": "Jawaabaha lama akhrin karo (JSON khaldan)."}
                ) from exc

        # Legacy mobile clients send deadline_days (int) instead of duration.
        if not parsed.get("deadline_duration"):
            deadline_days = parsed.pop("deadline_days", None)
            if deadline_days not in (None, ""):
                try:
                    days = int(deadline_days)
                except (TypeError, ValueError) as exc:
                    raise serializers.ValidationError(
                        {"deadline_days": "Maalmaha xadka waa inay noqdaan nambar."}
                    ) from exc
                if days <= 0:
                    raise serializers.ValidationError(
                        {"deadline_days": "Maalmaha xadka waa inay ka badnaadaan eber."}
                    )
                parsed["deadline_duration"] = timedelta(days=days)

        return super().to_internal_value(parsed)

    def validate(self, attrs):
        survey: Survey = attrs["survey"]
        if survey.status != Survey.Status.LIVE:
            raise serializers.ValidationError(
                "Kaliya sahanka furan (live) ayaa jawaab loo gudbin karaa."
            )

        if not survey.allow_multiple_submissions:
            dup_qs = Response.objects.filter(survey=survey)
            user = attrs.get("user")
            context_object = (attrs.get("context_object") or "").strip()
            context_id = (attrs.get("context_id") or "").strip()
            phone_number = (attrs.get("phone_number") or "").strip()

            if user:
                dup_qs = dup_qs.filter(user=user)
            elif context_object and context_id:
                dup_qs = dup_qs.filter(context_object=context_object, context_id=context_id)
            elif phone_number:
                dup_qs = dup_qs.filter(phone_number=phone_number)
            else:
                raise serializers.ValidationError(
                    "Sahankan wuxuu u baahan yahay user, telefoon, ama context "
                    "si loo hubiyo jawaab-bixiyaha."
                )

            if dup_qs.exists():
                raise serializers.ValidationError(
                    "Jawaab-bixiyahan horay ayuu u gudbiyay sahankan."
                )

        answers_data = attrs.get("answers") or []

        if not answers_data:
            required_questions = Question.objects.filter(section__survey=survey, required=True)
            if required_questions.exists():
                errors = [
                    f"Su'aasha qasabka ah '{q.text}' jawaab ma lahan."
                    for q in required_questions
                ]
                raise serializers.ValidationError({"answers": errors})
            return attrs

        question_ids = [item["question"].id for item in answers_data]
        questions = {
            q.id: q
            for q in Question.objects.filter(
                section__survey=survey,
                id__in=question_ids,
            ).prefetch_related("choices")
        }

        errors: list[str] = []

        for item in answers_data:
            question = questions.get(item["question"].id)
            if not question:
                errors.append(
                    f"Su'aasha {item['question'].id} kuma jirto sahankan."
                )
                continue

            choices = item.get("choices") or []
            if choices and question.qtype not in CHOICE_QTYPES:
                errors.append(f"Su'aasha '{question.text}' ma aqbasho doorashooyin.")
            if choices:
                valid_choice_ids = {c.id for c in question.choices.all()}
                for choice in choices:
                    if choice.id not in valid_choice_ids:
                        errors.append(
                            f"Doorasho khaldan ayaa loo diray su'aasha '{question.text}'."
                        )
                if question.qtype == Question.QType.SINGLE and len(choices) > 1:
                    errors.append(
                        f"Su'aasha '{question.text}' waxay aqbashaa doorasho keliya."
                    )
                other_selected = [c for c in choices if getattr(c, "is_other", False)]
                if other_selected and not (item.get("value_text") or "").strip():
                    label = other_selected[0].label or "Wax kale"
                    errors.append(
                        f"Su'aasha '{question.text}' waxay u baahan tahay qoraal "
                        f"marka '{label}' la doorto."
                    )
                if not other_selected:
                    # Keep choice analytics clean when Other is not selected.
                    item["value_text"] = ""

            if question.qtype in NUMERIC_QTYPES and item.get("value_number") is not None:
                value = item["value_number"]
                if question.min_value is not None and value < question.min_value:
                    errors.append(
                        f"'{question.text}' waa inay ahaato ugu yaraan {question.min_value}."
                    )
                if question.max_value is not None and value > question.max_value:
                    errors.append(
                        f"'{question.text}' waa inay ahaato ugu badnaan {question.max_value}."
                    )

        answer_map = {item["question"].id: item for item in answers_data}
        for question in Question.objects.filter(section__survey=survey, required=True):
            answer_data = answer_map.get(question.id)
            if not answer_data or not _answer_is_filled(question, answer_data):
                errors.append(f"Su'aasha qasabka ah '{question.text}' jawaab ma lahan.")

        if errors:
            raise serializers.ValidationError({"answers": errors})

        return attrs

    def create(self, validated_data):
        answers_data = validated_data.pop("answers", [])
        response = Response.objects.create(**validated_data)

        if not answers_data:
            return response

        pending_choices: list[list] = []
        answer_objs: list[Answer] = []
        for answer_data in answers_data:
            choices = answer_data.pop("choices", None) or []
            answer_data.pop("choice_ids", None)
            pending_choices.append(choices)
            answer_objs.append(Answer(response=response, **answer_data))

        created = Answer.objects.bulk_create(answer_objs)
        for answer, choices in zip(created, pending_choices):
            if choices:
                answer.choices.set(choices)

        return response

    def update(self, instance, validated_data):
        validated_data.pop("answers", None)
        return super().update(instance, validated_data)
