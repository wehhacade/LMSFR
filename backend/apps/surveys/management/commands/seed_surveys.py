"""
Seed rich survey + response data for development and UI testing.

Usage:
    python manage.py seed_surveys
    python manage.py seed_surveys --flush
"""

from __future__ import annotations

import random
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import County, SubCounty
from apps.core.cache import invalidate_cache
from apps.surveys.models import Answer, Choice, Question, Response, Survey, SurveySection

User = get_user_model()

SEED_SURVEY_NAMES = [
    "Community Safety Perception 2026",
    "Household Security Registration",
    "Police Service Satisfaction Index",
    "Youth & Community Engagement",
    "Annual Security Assessment 2025",
    "Neighbourhood Watch Enrollment",
]

MOGADISHU_COORDS = [
    (2.0469, 45.3182),
    (2.0371, 45.3438),
    (2.0594, 45.3256),
    (2.0288, 45.3511),
    (2.0523, 45.3098),
    (2.0412, 45.3365),
    (2.0631, 45.3412),
    (2.0345, 45.3178),
]

RESPONDENTS = [
    ("Abdikariin Ibraahim Mohamed", "615551201"),
    ("Fadumo Hassan Ali", "615552318"),
    ("Yuusuf Omar Warsame", "615553447"),
    ("Maryan Abdi Nur", "615554512"),
    ("Cali Maxamed Keynan", "615555689"),
    ("Hodan Sheikh Ahmed", "615556734"),
    ("Ibrahim Nur Aden", "615557801"),
    ("Amina Mohamed Guled", "615558902"),
    ("Mustafe Osman Farah", "615559013"),
    ("Sahra Cabdi Muse", "615550124"),
    ("Daahir Hassan Omar", "615551287"),
    ("Khadija Ali Warsame", "615552398"),
    ("Geedi Abshir Jama", "615553456"),
    ("Nasra Yusuf Ahmed", "615554567"),
    ("Bile Mohamud Nur", "615555678"),
    ("Layla Mohamed Hassan", "615556789"),
    ("Farah Abdi Keynan", "615557890"),
    ("Safia Nur Omar", "615558901"),
    ("Omar Hassan Ali", "615559012"),
    ("Hawa Yusuf Muse", "615550123"),
    ("Maxamed Cabdi Faarax", "615551234"),
    ("Zahra Abdi Hassan", "615552345"),
    ("Abdirizak Nur Warsame", "615553456"),
    ("Filsan Cabdi Ahmed", "615554567"),
    ("Axmed Maxamed Nuur", "615555678"),
    ("Sadiya Omar Jama", "615556789"),
    ("Rashid Hassan Keynan", "615557890"),
    ("Sumaya Ali Mohamed", "615558901"),
    ("Hamza Yusuf Guled", "615559012"),
    ("Nimco Abshir Farah", "615550234"),
    ("Liban Mohamud Ali", "615551345"),
    ("Anisa Nur Hassan", "615552456"),
    ("Jamaal Cabdi Omar", "615553567"),
    ("Deka Mohamed Warsame", "615554678"),
    ("Ismail Hassan Muse", "615555789"),
    ("Ruqiya Ali Keynan", "615556890"),
    ("Salah Nur Ahmed", "615557901"),
    ("Warsan Abdi Jama", "615558012"),
    ("Tahir Osman Hassan", "615559123"),
    ("Bilan Mohamed Ali", "615550345"),
    ("Feisal Cabdi Nur", "615551456"),
    ("Halima Yusuf Omar", "615552567"),
    ("Najma Hassan Warsame", "615553678"),
    ("Yasin Ali Muse", "615554789"),
    ("Asli Abdi Keynan", "615555890"),
    ("Mahad Nur Mohamed", "615556901"),
    ("Idil Hassan Ahmed", "615557012"),
    ("Kamal Osman Jama", "615558123"),
    ("Ladan Cabdi Ali", "615559234"),
]


def _add_question(section, order, text, qtype, *, required=True, help_text="", choices=None, min_value=None, max_value=None):
    question = Question.objects.create(
        section=section,
        text=text,
        help_text=help_text,
        qtype=qtype,
        required=required,
        order=order,
        min_value=min_value,
        max_value=max_value,
    )
    choice_objs = []
    if choices:
        for i, (label, value) in enumerate(choices):
            choice_objs.append(
                Choice.objects.create(question=question, label=label, value=value, order=i)
            )
    return question, choice_objs


def _build_community_safety_survey(survey: Survey) -> list[Question]:
    questions: list[Question] = []

    s1 = SurveySection.objects.create(survey=survey, title="About you", order=0)
    q, _ = _add_question(
        s1, 0, "Which district do you live in?", Question.QType.SINGLE, required=True,
        choices=[
            ("Hodan", "hodan"), ("Wadajir", "wadajir"), ("Yaqshid", "yaqshid"),
            ("Hamarweyne", "hamarweyne"), ("Bakaaro", "bakaaro"), ("Other", "other"),
        ],
    )
    questions.append(q)
    q, _ = _add_question(
        s1, 1, "How long have you lived in this area?", Question.QType.SINGLE, required=True,
        choices=[
            ("Less than 1 year", "lt1"), ("1–3 years", "1_3"),
            ("3–5 years", "3_5"), ("More than 5 years", "gt5"),
        ],
    )
    questions.append(q)
    q, _ = _add_question(s1, 2, "Your age group", Question.QType.SINGLE, required=True,
        choices=[("18–24", "18_24"), ("25–34", "25_34"), ("35–44", "35_44"), ("45+", "45_plus")])
    questions.append(q)

    s2 = SurveySection.objects.create(survey=survey, title="Safety perception", order=1)
    q, _ = _add_question(
        s2, 0, "How safe do you feel walking in your neighbourhood at night?",
        Question.QType.RATING, required=True, min_value=1, max_value=5,
        help_text="1 = Very unsafe, 5 = Very safe",
    )
    questions.append(q)
    q, _ = _add_question(
        s2, 1, "How would you rate police visibility in your area?",
        Question.QType.RATING, required=True, min_value=1, max_value=5,
    )
    questions.append(q)
    q, _ = _add_question(
        s2, 2, "Which security concerns affect you most? (select all that apply)",
        Question.QType.MULTI, required=True,
        choices=[
            ("Theft / burglary", "theft"), ("Armed robbery", "robbery"),
            ("Gang activity", "gangs"), ("Domestic violence", "domestic"),
            ("Traffic accidents", "traffic"), ("None", "none"),
        ],
    )
    questions.append(q)
    q, _ = _add_question(
        s2, 3, "Have you reported a crime to police in the last 12 months?",
        Question.QType.BOOL, required=True,
    )
    questions.append(q)

    s3 = SurveySection.objects.create(survey=survey, title="Feedback", order=2)
    q, _ = _add_question(
        s3, 0, "What would most improve safety in your community?",
        Question.QType.LONG, required=True,
    )
    questions.append(q)
    q, _ = _add_question(
        s3, 1, "Would you participate in a community patrol programme?",
        Question.QType.SINGLE, required=True,
        choices=[("Yes", "yes"), ("Maybe", "maybe"), ("No", "no")],
    )
    questions.append(q)
    q, _ = _add_question(s3, 2, "Date of last community meeting attended", Question.QType.DATE, required=False)
    questions.append(q)

    return questions


def _build_household_survey(survey: Survey) -> list[Question]:
    questions: list[Question] = []

    s1 = SurveySection.objects.create(survey=survey, title="Household details", order=0)
    q, _ = _add_question(s1, 0, "Household head full name", Question.QType.SHORT, required=True)
    questions.append(q)
    q, _ = _add_question(
        s1, 1, "Number of people living in the household", Question.QType.INT,
        required=True, min_value=1, max_value=30,
    )
    questions.append(q)
    q, _ = _add_question(
        s1, 2, "Type of residence", Question.QType.SINGLE, required=True,
        choices=[
            ("Owned house", "owned"), ("Rented apartment", "rented"),
            ("Shared compound", "shared"), ("Temporary shelter", "temp"),
        ],
    )
    questions.append(q)
    q, _ = _add_question(s1, 3, "Does the household have a perimeter wall or fence?", Question.QType.BOOL, required=True)
    questions.append(q)

    s2 = SurveySection.objects.create(survey=survey, title="Security measures", order=1)
    q, _ = _add_question(
        s2, 0, "Security features present (select all)", Question.QType.MULTI, required=True,
        choices=[
            ("Metal gate", "gate"), ("CCTV", "cctv"), ("Guard", "guard"),
            ("Alarm system", "alarm"), ("Street lighting nearby", "lighting"), ("None", "none"),
        ],
    )
    questions.append(q)
    q, _ = _add_question(
        s2, 1, "Estimated monthly spending on security (USD)", Question.QType.DEC,
        required=False, min_value=0, max_value=500,
    )
    questions.append(q)
    q, _ = _add_question(
        s2, 2, "Nearest police station", Question.QType.SHORT, required=True,
    )
    questions.append(q)

    return questions


def _build_police_satisfaction_survey(survey: Survey) -> list[Question]:
    questions: list[Question] = []

    s1 = SurveySection.objects.create(survey=survey, title="Service experience", order=0)
    for i, label in enumerate([
        "Overall satisfaction with police services",
        "Response time when you called for help",
        "Professionalism of officers",
        "Fairness and respect shown",
        "Follow-up on your case",
    ]):
        q, _ = _add_question(s1, i, label, Question.QType.RATING, required=True, min_value=1, max_value=5)
        questions.append(q)

    s2 = SurveySection.objects.create(survey=survey, title="Comments", order=1)
    q, _ = _add_question(
        s2, 0, "Which station did you interact with?", Question.QType.SINGLE, required=True,
        choices=[
            ("Hodan Station", "hodan"), ("Wadajir Station", "wadajir"),
            ("Central Station", "central"), ("Airport Station", "airport"), ("Other", "other"),
        ],
    )
    questions.append(q)
    q, _ = _add_question(s2, 1, "Additional comments or suggestions", Question.QType.LONG, required=False)
    questions.append(q)
    q, _ = _add_question(s2, 2, "Would you recommend police services to others?", Question.QType.BOOL, required=True)
    questions.append(q)

    return questions


def _build_youth_survey(survey: Survey) -> list[Question]:
    questions: list[Question] = []

    s1 = SurveySection.objects.create(survey=survey, title="Participation", order=0)
    q, _ = _add_question(s1, 0, "Your age", Question.QType.INT, required=True, min_value=15, max_value=35)
    questions.append(q)
    q, _ = _add_question(
        s1, 1, "Activities you are interested in (select all)", Question.QType.MULTI, required=True,
        choices=[
            ("Sports programmes", "sports"), ("Skills training", "skills"),
            ("Mentorship", "mentorship"), ("Volunteer patrols", "patrols"),
            ("Arts & culture", "arts"), ("Job placement", "jobs"),
        ],
    )
    questions.append(q)
    q, _ = _add_question(
        s1, 2, "How many hours per week can you volunteer?", Question.QType.SINGLE, required=True,
        choices=[("1–3 hours", "1_3"), ("4–6 hours", "4_6"), ("7+ hours", "7_plus"), ("Not sure", "unsure")],
    )
    questions.append(q)
    q, _ = _add_question(s1, 3, "Brief statement on why you want to join", Question.QType.LONG, required=True)
    questions.append(q)

    return questions


def _build_annual_assessment_survey(survey: Survey) -> list[Question]:
    questions: list[Question] = []

    s1 = SurveySection.objects.create(survey=survey, title="Annual review", order=0)
    q, _ = _add_question(
        s1, 0, "Overall security situation compared to last year", Question.QType.SINGLE, required=True,
        choices=[("Much better", "much_better"), ("Slightly better", "slightly_better"),
                 ("Same", "same"), ("Worse", "worse"), ("Much worse", "much_worse")],
    )
    questions.append(q)
    q, _ = _add_question(s1, 1, "Crime reduction rating", Question.QType.RATING, required=True, min_value=1, max_value=5)
    questions.append(q)
    q, _ = _add_question(s1, 2, "Key achievements noted this year", Question.QType.LONG, required=True)
    questions.append(q)

    return questions


def _build_draft_survey(survey: Survey) -> list[Question]:
    s1 = SurveySection.objects.create(survey=survey, title="Enrollment", order=0)
    q, _ = _add_question(
        s1, 0, "Neighbourhood name", Question.QType.SHORT, required=True,
    )
    q2, _ = _add_question(
        s1, 1, "Preferred patrol shift", Question.QType.SINGLE, required=True,
        choices=[("Morning", "morning"), ("Afternoon", "afternoon"), ("Evening", "evening")],
    )
    return [q, q2]


def _answer_for_question(rng: random.Random, response: Response, question: Question, choice_map: dict[int, list[Choice]]):
    qtype = question.qtype

    if qtype == Question.QType.SINGLE:
        choices = choice_map[question.pk]
        picked = rng.choice(choices)
        answer = Answer.objects.create(response=response, question=question)
        answer.choices.set([picked])
        return answer

    if qtype == Question.QType.MULTI:
        choices = choice_map[question.pk]
        count = rng.randint(1, min(3, len(choices)))
        picked = rng.sample(choices, count)
        answer = Answer.objects.create(response=response, question=question)
        answer.choices.set(picked)
        return answer

    answer = Answer(response=response, question=question)
    if qtype == Question.QType.SHORT:
        answer.value_text = rng.choice([
            "Axmed Hassan", "House 42 Block C", "Near KM4 junction", "Wadajir district",
            "Hodan police post", "Compound 15", "Bakaaro market area",
        ])
    elif qtype == Question.QType.LONG:
        answer.value_text = rng.choice([
            "More street lighting and community patrols would help our area feel safer at night.",
            "Police response has improved but we still need faster follow-up on reported cases.",
            "Youth programmes and job opportunities would reduce crime in our neighbourhood.",
            "We need better coordination between residents and local police stations.",
            "Traffic control and road safety are also major concerns for families here.",
        ])
    elif qtype == Question.QType.INT:
        lo = int(question.min_value or 1)
        hi = int(question.max_value or 10)
        answer.value_number = Decimal(str(rng.randint(lo, hi)))
    elif qtype == Question.QType.DEC:
        lo = float(question.min_value or 0)
        hi = float(question.max_value or 100)
        answer.value_number = Decimal(str(round(rng.uniform(lo, hi), 2)))
    elif qtype == Question.QType.DATE:
        days_ago = rng.randint(30, 400)
        answer.value_date = date.today() - timedelta(days=days_ago)
    elif qtype == Question.QType.RATING:
        lo = int(question.min_value or 1)
        hi = int(question.max_value or 5)
        answer.value_number = Decimal(str(rng.randint(lo, hi)))
    elif qtype == Question.QType.BOOL:
        answer.value_bool = rng.choice([True, False])

    answer.save()
    return answer


def _create_response(
    rng: random.Random,
    survey: Survey,
    questions: list[Question],
    choice_map: dict[int, list[Choice]],
    *,
    respondent_idx: int,
    counties: list[County],
    subcounties: list[SubCounty],
    submitted_at,
    completion: str,
    with_location: bool = True,
):
    name, phone = RESPONDENTS[respondent_idx % len(RESPONDENTS)]
    county = rng.choice(counties) if counties else None
    sub = None
    if county:
        subs = [s for s in subcounties if s.county_id == county.pk]
        sub = rng.choice(subs) if subs else None

    lat, lng = rng.choice(MOGADISHU_COORDS) if with_location else (None, None)
    if lat is not None:
        lat = Decimal(str(round(lat + rng.uniform(-0.008, 0.008), 6)))
        lng = Decimal(str(round(lng + rng.uniform(-0.008, 0.008), 6)))

    response = Response.objects.create(
        survey=survey,
        phone_number=phone,
        guri_number=f"G-{rng.randint(100, 999)}/{rng.randint(1, 50)}",
        county=county,
        sub_county=sub,
        latitude=lat,
        longitude=lng,
        context_object="household",
        context_id=str(rng.randint(10000, 99999)),
    )
    Response.objects.filter(pk=response.pk).update(submitted_at=submitted_at)

    if completion == "partial":
        answer_count = max(0, int(len(questions) * rng.uniform(0, 0.7)))
    else:
        answer_count = len(questions)

    for question in questions[:answer_count]:
        _answer_for_question(rng, response, question, choice_map)

    return response


def _submitted_at_weighted(rng: random.Random, days_back: int = 30):
    day_offset = rng.choices(range(days_back), weights=[i + 1 for i in range(days_back)])[0]
    hour = rng.randint(7, 21)
    minute = rng.randint(0, 59)
    base = timezone.now() - timedelta(days=day_offset)
    return base.replace(hour=hour, minute=minute, second=0, microsecond=0)


def _choice_map_for_survey(survey: Survey) -> tuple[list[Question], dict[int, list[Choice]]]:
    questions = list(
        Question.objects.filter(section__survey=survey)
        .prefetch_related("choices")
        .order_by("section__order", "order", "id")
    )
    choice_map = {q.pk: list(q.choices.all()) for q in questions}
    return questions, choice_map


class Command(BaseCommand):
    help = "Seed surveys with sections, questions, and realistic responses for UI testing."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete previously seeded surveys (by name) before creating new data.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        rng = random.Random(2026)

        if options["flush"]:
            deleted, _ = Survey.objects.filter(name__in=SEED_SURVEY_NAMES).delete()
            self.stdout.write(self.style.WARNING(f"Flushed {deleted} related objects from seed surveys."))

        admin = User.objects.filter(is_admin=True).order_by("id").first()
        if not admin:
            admin = User.objects.filter(is_superuser=True).order_by("id").first()

        counties = list(County.objects.all()[:12])
        subcounties = list(SubCounty.objects.select_related("county").all()[:40])
        if not counties:
            self.stdout.write(self.style.WARNING(
                "No counties found — run seed_locations first. Responses will omit location fields."
            ))

        specs = [
            {
                "name": "Community Safety Perception 2026",
                "description": (
                    "Nationwide community survey measuring perceptions of safety, police visibility, "
                    "and priority security concerns across Mogadishu districts."
                ),
                "status": Survey.Status.LIVE,
                "allow_multiple": False,
                "builder": _build_community_safety_survey,
                "responses": 52,
                "days_back": 30,
                "completion_mix": (0.58, 0.27, 0.15),
            },
            {
                "name": "Household Security Registration",
                "description": (
                    "Register households for the community security database. "
                    "Collects residence type, security measures, and contact details."
                ),
                "status": Survey.Status.LIVE,
                "allow_multiple": True,
                "builder": _build_household_survey,
                "responses": 34,
                "days_back": 30,
                "completion_mix": (0.65, 0.22, 0.13),
            },
            {
                "name": "Police Service Satisfaction Index",
                "description": (
                    "Quarterly citizen satisfaction survey for police stations — "
                    "response time, professionalism, and case follow-up."
                ),
                "status": Survey.Status.LIVE,
                "allow_multiple": False,
                "builder": _build_police_satisfaction_survey,
                "responses": 28,
                "days_back": 30,
                "completion_mix": (0.72, 0.20, 0.08),
            },
            {
                "name": "Youth & Community Engagement",
                "description": "Recruit young volunteers for sports, mentorship, and neighbourhood programmes.",
                "status": Survey.Status.LIVE,
                "allow_multiple": False,
                "builder": _build_youth_survey,
                "responses": 16,
                "days_back": 21,
                "completion_mix": (0.55, 0.35, 0.10),
            },
            {
                "name": "Annual Security Assessment 2025",
                "description": "Year-end security assessment — now closed. Historical responses for reporting.",
                "status": Survey.Status.CLOSED,
                "allow_multiple": False,
                "builder": _build_annual_assessment_survey,
                "responses": 18,
                "days_back": 90,
                "completion_mix": (0.80, 0.15, 0.05),
                "day_offset_base": 45,
            },
            {
                "name": "Neighbourhood Watch Enrollment",
                "description": "Draft enrollment form for neighbourhood watch volunteers — not yet published.",
                "status": Survey.Status.DRAFT,
                "allow_multiple": False,
                "builder": _build_draft_survey,
                "responses": 0,
            },
        ]

        surveys_created = 0
        responses_created = 0
        respondent_cursor = 0

        for spec in specs:
            survey, created = Survey.objects.update_or_create(
                name=spec["name"],
                defaults={
                    "description": spec["description"],
                    "status": spec["status"],
                    "allow_multiple_submissions": spec["allow_multiple"],
                    "created_by": admin,
                },
            )
            if survey.sections.count() == 0:
                spec["builder"](survey)
                self.stdout.write(self.style.SUCCESS(f"  Built survey structure: {survey.name}"))
            elif created:
                self.stdout.write(self.style.SUCCESS(f"  Created survey: {survey.name}"))
            else:
                self.stdout.write(f"  Survey exists: {survey.name}")

            if created:
                surveys_created += 1

            if spec["responses"] <= 0:
                continue

            existing = survey.responses.count()
            if existing >= spec["responses"]:
                self.stdout.write(f"    Skipping responses ({existing} already exist)")
                continue

            questions, choice_map = _choice_map_for_survey(survey)
            if not questions:
                spec["builder"](survey)
                questions, choice_map = _choice_map_for_survey(survey)

            to_create = spec["responses"] - existing
            _, partial_w, abandon_w = spec.get("completion_mix", (0.6, 0.25, 0.15))
            partial_w += abandon_w
            day_offset_base = spec.get("day_offset_base", 0)

            for _ in range(to_create):
                roll = rng.random()
                if roll < partial_w:
                    completion = "partial"
                else:
                    completion = "complete"

                if day_offset_base:
                    day_offset = day_offset_base + rng.randint(0, spec.get("days_back", 30))
                    submitted_at = timezone.now() - timedelta(days=day_offset, hours=rng.randint(8, 18))
                else:
                    submitted_at = _submitted_at_weighted(rng, spec.get("days_back", 30))

                _create_response(
                    rng,
                    survey,
                    questions,
                    choice_map,
                    respondent_idx=respondent_cursor,
                    counties=counties,
                    subcounties=subcounties,
                    submitted_at=submitted_at,
                    completion=completion,
                )
                respondent_cursor += 1
                responses_created += 1

        invalidate_cache("survey")

        total_surveys = Survey.objects.filter(name__in=SEED_SURVEY_NAMES).count()
        total_responses = Response.objects.filter(survey__name__in=SEED_SURVEY_NAMES).count()
        self.stdout.write(self.style.SUCCESS(
            f"\nSeed complete: {surveys_created} surveys created, "
            f"{responses_created} new responses added.\n"
            f"Totals: {total_surveys} seed surveys, {total_responses} responses."
        ))
        self.stdout.write("Open the Survey module dashboard to review charts and response lists.")
