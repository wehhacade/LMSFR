"""One-off web importer for the Google-Forms style CCTV survey exports.

This is intentionally scoped to the known column layout of the
"XOGTA KAAMIROOYINKA ..." export sheets rather than being a generic
spreadsheet importer: header text, question wording and choice labels are
matched exactly against what that form already produces so mismatches fail
loudly instead of being silently mapped to the wrong question.
"""
import difflib
import hashlib
import re
from datetime import datetime

import openpyxl
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import County, SubCounty
from apps.surveys.models import Answer, Choice, Question, Response, Survey

CONTEXT_OBJECT = "xlsx_import"

# Column header (as it appears in the sheet, stripped) -> internal key.
EXPECTED_HEADERS = {
    "Timestamp": "timestamp",
    "MAGACA SARKAALKA": "officer_name",
    "NUUCA GURIGA": "house_type",
    "WAAXDA": "waaxda",
    "MAGACA MILKIILAHA": "owner_name",
    "TALEEFANKA MILKIILAHA": "owner_phone",
    "MAGACA WAKIILKA GURIGA": "agent_name",
    "TALEEFANKA WAKIILKA GURIGA": "agent_phone",
    "MGRS": "coords",
    "KAAMIRO MA XIRANTAHAY": "camera_installed",
    "NUUCA KAAMIRADA": "camera_brand",
    "HDD SIZE": "hdd_size",
    "STORAGE TIME": "storage_time",
    "KAAMIRADA BANAANKA SI SAXAN MA U XIRAN TAHAY": "outdoor_ok",
    "HABIINKII MA SHAQEYNEYSAA KAAMIRADA": "works_at_night",
    "MAGACA DAMIINKA WAQTIGA LA XIRAAYO KAAMIRADA": "guarantor_name",
    "TALEEFANKA DAMIINKA": "guarantor_phone",
    "CABASHO MA JIRTAA": "has_complaint",
    "NUUCA CABASHADA": "complaint_text",
    "MAGACA GOOTA (AREA)": "area_name",
}

# Different district exports retype these headers with small spelling
# variations. Normalized (stripped, whitespace-collapsed) sheet header ->
# the canonical header key above. Extend this as new districts surface more.
HEADER_ALIASES = {
    "STORAGE TME": "STORAGE TIME",
    "HABIINKII MA SHAQEYNEE KAAMIRADA": "HABIINKII MA SHAQEYNEYSAA KAAMIRADA",
    "MAGACA GOOBTA (AREA)": "MAGACA GOOTA (AREA)",
}

# Existing Question.text values already on the live survey.
Q_HOUSE_TYPE = "NUUCA GURIGA"
Q_OWNER_NAME = "MAGACA MILKILAHA"
Q_AGENT_NAME = "MAGACA WAKIILKA GURIGA"
Q_AGENT_PHONE = "TALEEFANKA WAKIILKA"
Q_CAMERA_INSTALLED = "KAAMIRO MA XIRAN TAHAY"
Q_CAMERA_BRAND = "NUUCA KAAMIRADA"
Q_HDD_SIZE = "HDD SIZE"
Q_STORAGE_TIME = "STORAGE TIME"
Q_OUTDOOR_OK = "KAAMIRADA BANAANKA SI SAXAN MA U XIRANTAHAY"
Q_WORKS_AT_NIGHT = "HABEEN MA SHAQEYNEYSAA"
Q_AREA_NAME = "MAGACA GOOBTA (AREA)"

# New questions this import adds to the survey the first time it runs.
Q_GUARANTOR_NAME = "MAGACA DAMIINKA WAQTIGA LA XIRAAYO KAAMIRADA"
Q_GUARANTOR_PHONE = "TALEEFANKA DAMIINKA"
Q_HAS_COMPLAINT = "CABASHO MA JIRTAA"
Q_COMPLAINT_TEXT = "NUUCA CABASHADA"

# Choice label synonyms: sheet spelling -> existing Choice label on the question.
CHOICE_SYNONYMS = {
    Q_CAMERA_BRAND: {"ATHER": "ATHERS"},
}

# The uploaded filename tells us which district/county this batch covers,
# e.g. "XOGTA KAAMIROOYINKA DEGMADA BOONDHEERE (Responses).xlsx" -> Boondheere.
DEGMADA_FILENAME_RE = re.compile(r"DEGMADA\s+([A-Z\-\s]+?)(?:\s*\(|\.xlsx|$)", re.IGNORECASE)

# WAAXDA free text (normalized, "waaxda"/"waxda"/"waxada" prefix stripped) that
# doesn't fuzzy-match its SubCounty name closely enough on its own -> the
# SubCounty.name to use instead. Extend this as new districts surface more.
WAAXDA_ALIASES = {
    "daljirka": "Darjiinka Daahsoon",
}

WAAXDA_PREFIX_RE = re.compile(r"^(waaxda|waxda|waxada|degmada)\s+", re.IGNORECASE)

SUBCOUNTY_FUZZY_CUTOFF = 0.72
OFFICER_FUZZY_CUTOFF = 0.84

# Officer name (normalized, as typed in the sheet) -> normalized "first last"
# of an existing is_officer=True account. Built from a manual audit against
# the 24 officer accounts that existed at the time this importer was written;
# names typed differently in future sheets simply come back "unmatched".
# Matching is done against normalized names (case-folded, whitespace-collapsed)
# because several DB records have stray leading/trailing spaces.
OFFICER_NAME_MAP = {
    "abdi fitaax faarax salaad": "cabdifitaax faarax",
    "abdi fitaax faarax": "cabdifitaax faarax",
    "binibashar abdulahi hashi": "binibashar abdulahi hashi",
    "binibashar abdullahinhashi": "binibashar abdulahi hashi",
    "binibashar abdullahi hashi": "binibashar abdulahi hashi",
    "faysal abdi": "faysal abdi warsame",
    "ibrahim yacqub xasan": "ibrahim yacqub hasan",
    "bashir abdirahman dini": "bashir dini",
    "ahmed geedi maxamud": "ahmed geedi maxamud",
    "ibrahim ahmed abdulle": "ibrahim ahmed abdulle",
    "hanad ali isse": "hanad ali isse",
}

MOGADISHU_LAT_RANGE = (1.8, 2.3)
MOGADISHU_LON_RANGE = (45.1, 45.6)

_COORD_RE = re.compile(r"-?\d+\.\d+")


class XlsxImportError(Exception):
    pass


class _DryRunRollback(Exception):
    pass


def _normalize(value) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _normalize_lower(value) -> str:
    return _normalize(value).lower()


def _normalize_phone(value) -> str:
    if value in (None, ""):
        return ""
    if isinstance(value, float):
        raw = str(int(value))
    else:
        raw = str(value)
    digits = re.sub(r"\D", "", raw)
    if digits and len(digits) < 10:
        digits = digits.zfill(10)
    return digits


def _parse_coords(raw) -> tuple[float | None, float | None]:
    text = _normalize(raw)
    if not text:
        return None, None
    nums = _COORD_RE.findall(text)
    if len(nums) < 2:
        return None, None
    lat, lon = float(nums[0]), float(nums[1])
    if not (MOGADISHU_LAT_RANGE[0] <= lat <= MOGADISHU_LAT_RANGE[1]):
        return None, None
    if not (MOGADISHU_LON_RANGE[0] <= lon <= MOGADISHU_LON_RANGE[1]):
        return None, None
    return lat, lon


def _row_hash(survey_id: int, raw_row: tuple) -> str:
    payload = f"{survey_id}|" + "|".join(str(v) for v in raw_row)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _read_rows(fileobj):
    wb = openpyxl.load_workbook(fileobj, data_only=True)
    ws = wb.active
    header_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True))
    headers = [HEADER_ALIASES.get(_normalize(h), _normalize(h)) for h in header_row]

    missing = [h for h in EXPECTED_HEADERS if h not in headers]
    if missing:
        raise XlsxImportError(
            "Sheet is missing expected column(s): " + ", ".join(missing)
        )

    col_index = {EXPECTED_HEADERS[h]: i for i, h in enumerate(headers) if h in EXPECTED_HEADERS}
    rows = []
    for raw_row in ws.iter_rows(min_row=2, values_only=True):
        if all(v is None for v in raw_row):
            continue
        rows.append((raw_row, {key: raw_row[idx] for key, idx in col_index.items()}))
    return rows


def _get_or_create_extra_questions(section, summary: dict) -> dict[str, Question]:
    order_start = (
        Question.objects.filter(section=section).count()
    )
    specs = [
        (Q_GUARANTOR_NAME, Question.QType.SHORT, None),
        (Q_GUARANTOR_PHONE, Question.QType.SHORT, None),
        (Q_HAS_COMPLAINT, Question.QType.SINGLE, [("HAA", "haa"), ("MAYA", "maya")]),
        (Q_COMPLAINT_TEXT, Question.QType.LONG, None),
    ]
    questions = {}
    for offset, (text, qtype, choices) in enumerate(specs):
        question, created = Question.objects.get_or_create(
            section=section,
            text=text,
            defaults={
                "qtype": qtype,
                "required": False,
                "order": order_start + offset,
            },
        )
        # Keep these fields optional even if they already existed as required.
        if question.required:
            question.required = False
            question.save(update_fields=["required"])
        if created:
            summary["new_questions_created"].append(text)
            if choices:
                for c_order, (label, value) in enumerate(choices):
                    Choice.objects.create(question=question, label=label, value=value, order=c_order)
        questions[text] = question
    return questions


def _build_choice_lookup(questions: dict[str, Question]) -> dict[int, dict[str, Choice]]:
    """{question.id: {normalized label-or-value: Choice}}, built once so
    per-row matching is a dict lookup instead of a DB query."""
    lookup: dict[int, dict[str, Choice]] = {}
    for question in questions.values():
        by_key: dict[str, Choice] = {}
        for choice in question.choices.all():
            by_key.setdefault(_normalize_lower(choice.label), choice)
            by_key.setdefault(_normalize_lower(choice.value), choice)
        lookup[question.id] = by_key
    return lookup


def _match_choice(question: Question, raw_label, choice_lookup: dict[int, dict[str, Choice]]) -> Choice | None:
    label = _normalize(raw_label)
    if not label:
        return None
    synonym = CHOICE_SYNONYMS.get(question.text, {}).get(label.upper())
    target = _normalize_lower(synonym or label)
    return choice_lookup.get(question.id, {}).get(target)


def _build_officer_lookup() -> dict[str, int]:
    from django.contrib.auth import get_user_model

    User = get_user_model()
    lookup: dict[str, int] = {}
    for uid, first, last in User.objects.filter(is_officer=True).values_list(
        "id", "first_name", "last_name"
    ):
        lookup[_normalize_lower(f"{first} {last}")] = uid
    return lookup


def _match_officer(raw_name, officer_lookup: dict[str, int]) -> tuple[int | None, bool]:
    """Returns (user_id, was_fuzzy). was_fuzzy flags matches that weren't an
    exact/mapped hit, so callers can surface them for manual spot-checking."""
    key = _normalize_lower(raw_name)
    if not key:
        return None, False

    target = OFFICER_NAME_MAP.get(key)
    if target:
        return officer_lookup.get(target), False

    if key in officer_lookup:
        return officer_lookup[key], False

    close = difflib.get_close_matches(key, officer_lookup.keys(), n=1, cutoff=OFFICER_FUZZY_CUTOFF)
    if close:
        return officer_lookup[close[0]], True

    return None, False


def _detect_county_from_filename(filename: str) -> County | None:
    m = DEGMADA_FILENAME_RE.search(filename or "")
    if not m:
        return None
    name = _normalize(m.group(1))
    return (
        County.objects.filter(name__iexact=name).first()
        or County.objects.filter(name__icontains=name).first()
    )


def _build_subcounty_lookup(county: County) -> dict[str, SubCounty]:
    return {
        _normalize_lower(sc.name): sc
        for sc in SubCounty.objects.filter(county=county)
    }


def _match_subcounty(raw_waaxda, subcounty_lookup: dict[str, SubCounty]) -> SubCounty | None:
    text = _normalize_lower(WAAXDA_PREFIX_RE.sub("", _normalize(raw_waaxda)))
    if not text:
        return None

    alias = WAAXDA_ALIASES.get(text)
    if alias:
        return subcounty_lookup.get(_normalize_lower(alias))

    if text in subcounty_lookup:
        return subcounty_lookup[text]

    for name_key, sc in subcounty_lookup.items():
        if name_key and (name_key in text or text in name_key):
            return sc

    close = difflib.get_close_matches(text, subcounty_lookup.keys(), n=1, cutoff=SUBCOUNTY_FUZZY_CUTOFF)
    if close:
        return subcounty_lookup[close[0]]

    return None


def import_xlsx_responses(
    survey: Survey, fileobj, *, importing_user_id: int, filename: str = "", dry_run: bool = True
) -> dict:
    try:
        rows = _read_rows(fileobj)
    except XlsxImportError:
        raise
    except Exception as exc:  # openpyxl / zip errors on a corrupt upload
        raise XlsxImportError(f"Could not read the file as an Excel workbook: {exc}") from exc

    if not rows:
        raise XlsxImportError("The sheet has no data rows.")

    county = _detect_county_from_filename(filename)
    if county is None:
        raise XlsxImportError(
            "Could not tell which district this file covers. Expected the filename to "
            "contain 'DEGMADA <COUNTY NAME>' (e.g. 'DEGMADA BOONDHEERE'), matching one "
            "of the existing counties."
        )

    summary = {
        "total_rows": len(rows),
        "created": 0,
        "skipped_duplicate": 0,
        "detected_county": county.name,
        "unmatched_officers": {},
        "fuzzy_matched_officers": {},
        "unmatched_subcounties": {},
        "interpolated_coordinates": 0,
        "new_questions_created": [],
        "row_errors": [],
        "dry_run": dry_run,
    }

    try:
        with transaction.atomic():
            _run_import(survey, rows, summary, importing_user_id, county)
            if dry_run:
                raise _DryRunRollback()
    except _DryRunRollback:
        pass

    return summary


def _run_import(survey: Survey, rows: list, summary: dict, importing_user_id: int, county: County) -> None:
    section = survey.sections.order_by("order", "id").first()
    if section is None:
        raise XlsxImportError("This survey has no section to attach questions/answers to.")

    existing_by_text = {
        q.text: q
        for q in Question.objects.filter(section__survey=survey).prefetch_related("choices")
    }
    required_existing = [Q_HOUSE_TYPE, Q_OWNER_NAME, Q_AGENT_NAME, Q_AGENT_PHONE,
                          Q_CAMERA_INSTALLED, Q_CAMERA_BRAND, Q_HDD_SIZE, Q_STORAGE_TIME,
                          Q_OUTDOOR_OK, Q_WORKS_AT_NIGHT, Q_AREA_NAME]
    missing_q = [t for t in required_existing if t not in existing_by_text]
    if missing_q:
        raise XlsxImportError(
            "Survey is missing expected question(s): " + ", ".join(missing_q)
        )

    extra_questions = _get_or_create_extra_questions(section, summary)
    questions = {**existing_by_text, **extra_questions}
    choice_lookup = _build_choice_lookup(questions)
    officer_lookup = _build_officer_lookup()

    subcounty_lookup = _build_subcounty_lookup(county)
    if not subcounty_lookup:
        raise XlsxImportError(f"County '{county.name}' has no SubCounty records.")

    # One query for every context_id already imported for this survey, so the
    # per-row duplicate check below is an in-memory set lookup, not a query.
    existing_context_ids = set(
        Response.objects.filter(survey=survey, context_object=CONTEXT_OBJECT).values_list(
            "context_id", flat=True
        )
    )

    # Pass 1: parse coordinates so out-of-range rows can borrow the average
    # for their own WAAXDA instead of storing a garbage location.
    parsed_coords = []
    coords_by_waaxda: dict[str, list[tuple[float, float]]] = {}
    for raw_row, data in rows:
        lat, lon = _parse_coords(data.get("coords"))
        waaxda_key = _normalize_lower(data.get("waaxda"))
        parsed_coords.append((lat, lon))
        if lat is not None:
            coords_by_waaxda.setdefault(waaxda_key, []).append((lat, lon))

    fallback_avg = None
    all_valid = [c for cs in coords_by_waaxda.values() for c in cs]
    if all_valid:
        fallback_avg = (
            sum(c[0] for c in all_valid) / len(all_valid),
            sum(c[1] for c in all_valid) / len(all_valid),
        )

    # Pass 2: build unsaved Response instances in memory, then write everything
    # in a handful of bulk queries instead of ~15-20 queries per row (which is
    # what made a 797-row file take over a minute).
    pending: list[dict] = []
    for row_idx, ((raw_row, data), (lat, lon)) in enumerate(zip(rows, parsed_coords), start=2):
        row_hash = _row_hash(survey.id, raw_row)
        if row_hash in existing_context_ids:
            summary["skipped_duplicate"] += 1
            continue
        existing_context_ids.add(row_hash)  # guards against dupes within this same file too

        waaxda_raw = data.get("waaxda")
        waaxda_key = _normalize_lower(waaxda_raw)
        sub_county = _match_subcounty(waaxda_raw, subcounty_lookup)
        if sub_county is None:
            # The county itself is known (from the filename) even when the
            # specific WAAXDA text doesn't match a sub-county — keep the row
            # with county set and sub_county blank rather than losing all its
            # other data over one unresolved field.
            label = _normalize(waaxda_raw) or "(blank)"
            summary["unmatched_subcounties"][label] = summary["unmatched_subcounties"].get(label, 0) + 1
            summary["row_errors"].append(
                f"Row {row_idx}: unrecognized WAAXDA '{label}', imported with county only (no sub-county)."
            )

        if lat is None:
            candidates = coords_by_waaxda.get(waaxda_key)
            if candidates:
                lat = sum(c[0] for c in candidates) / len(candidates)
                lon = sum(c[1] for c in candidates) / len(candidates)
            elif fallback_avg:
                lat, lon = fallback_avg
            summary["interpolated_coordinates"] += 1

        officer_name = data.get("officer_name")
        user_id, was_fuzzy = _match_officer(officer_name, officer_lookup)
        if user_id is None:
            label = _normalize(officer_name) or "(blank)"
            summary["unmatched_officers"][label] = summary["unmatched_officers"].get(label, 0) + 1
            # No matching officer account — attribute the response to whoever ran the import.
            user_id = importing_user_id
        elif was_fuzzy:
            label = _normalize(officer_name) or "(blank)"
            summary["fuzzy_matched_officers"][label] = summary["fuzzy_matched_officers"].get(label, 0) + 1

        timestamp_raw = data.get("timestamp")
        submitted_at = None
        if isinstance(timestamp_raw, datetime):
            submitted_at = timestamp_raw
            if timezone.is_naive(submitted_at):
                submitted_at = timezone.make_aware(submitted_at, timezone.get_default_timezone())

        response_obj = Response(
            survey=survey,
            user_id=user_id,
            county_id=county.id,
            sub_county=sub_county,
            phone_number=_normalize_phone(data.get("owner_phone")),
            latitude=lat,
            longitude=lon,
            context_object=CONTEXT_OBJECT,
            context_id=row_hash,
        )
        pending.append({
            "response": response_obj,
            "submitted_at": submitted_at,
            "row_idx": row_idx,
            "data": data,
        })

    if not pending:
        return

    created_responses = Response.objects.bulk_create([p["response"] for p in pending])

    to_fix_timestamps = []
    for p, created_resp in zip(pending, created_responses):
        p["response"] = created_resp
        if p["submitted_at"] is not None:
            created_resp.submitted_at = p["submitted_at"]
            to_fix_timestamps.append(created_resp)
    if to_fix_timestamps:
        Response.objects.bulk_update(to_fix_timestamps, ["submitted_at"], batch_size=500)

    answer_specs: list[tuple[Answer, Choice | None]] = []
    for p in pending:
        answer_specs.extend(
            _build_answer_specs(p["response"], questions, choice_lookup, p["data"], summary, p["row_idx"])
        )

    if not answer_specs:
        summary["created"] = len(created_responses)
        return

    created_answers = Answer.objects.bulk_create([spec[0] for spec in answer_specs], batch_size=1000)

    through_model = Answer.choices.through
    through_rows = [
        through_model(answer_id=created_answer.pk, choice_id=choice.pk)
        for created_answer, (_, choice) in zip(created_answers, answer_specs)
        if choice is not None
    ]
    if through_rows:
        through_model.objects.bulk_create(through_rows, batch_size=1000)

    summary["created"] = len(created_responses)


def _build_answer_specs(response, questions, choice_lookup, data, summary, row_idx) -> list[tuple[Answer, Choice | None]]:
    specs: list[tuple[Answer, Choice | None]] = []

    def add_text(question: Question, value) -> None:
        text = _normalize(value)
        if text:
            specs.append((Answer(response=response, question=question, value_text=text), None))

    def add_choice(question: Question, raw_value) -> None:
        label = _normalize(raw_value)
        if not label:
            return
        choice = _match_choice(question, label, choice_lookup)
        if choice is None:
            summary["row_errors"].append(
                f"Row {row_idx}: no choice matching '{label}' for question '{question.text}', answer skipped."
            )
            return
        specs.append((Answer(response=response, question=question), choice))

    add_choice(questions[Q_HOUSE_TYPE], data.get("house_type"))
    add_text(questions[Q_OWNER_NAME], data.get("owner_name"))
    add_text(questions[Q_AGENT_NAME], data.get("agent_name"))
    add_text(questions[Q_AGENT_PHONE], _normalize_phone(data.get("agent_phone")))
    add_choice(questions[Q_CAMERA_INSTALLED], data.get("camera_installed"))
    add_choice(questions[Q_CAMERA_BRAND], data.get("camera_brand"))
    add_choice(questions[Q_HDD_SIZE], data.get("hdd_size"))
    add_choice(questions[Q_STORAGE_TIME], data.get("storage_time"))
    add_choice(questions[Q_OUTDOOR_OK], data.get("outdoor_ok"))
    add_choice(questions[Q_WORKS_AT_NIGHT], data.get("works_at_night"))
    add_text(questions[Q_AREA_NAME], data.get("area_name"))
    add_text(questions[Q_GUARANTOR_NAME], data.get("guarantor_name"))
    add_text(questions[Q_GUARANTOR_PHONE], _normalize_phone(data.get("guarantor_phone")))
    add_choice(questions[Q_HAS_COMPLAINT], data.get("has_complaint"))
    add_text(questions[Q_COMPLAINT_TEXT], data.get("complaint_text"))

    return specs
