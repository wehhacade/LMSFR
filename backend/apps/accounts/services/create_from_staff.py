"""Create Agent + User from a Staff payroll row."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import transaction
from django.db.models import Q

from apps.accounts.models import Agent, County, Directorate, Staff
from apps.accounts.services.staff_search import exact_numeric_variants, staff_agent_lookup_q

User = get_user_model()

DEFAULT_AGENT_DOB = "1991-06-26"
MAX_PROFILE_BYTES = 2_621_440  # 2.5 MB
ALLOWED_CONTENT = {"image/jpeg", "image/jpg", "image/png"}


def split_staff_name(full_name: str) -> tuple[str, str, str, str, str, str]:
    parts = [p for p in (full_name or "").split() if p] or ["N/A"]
    while len(parts) < 4:
        parts.append("N/A")
    if len(parts) > 4:
        parts = parts[:3] + [" ".join(parts[3:])]
    first, father, last, fourth = (parts[0][:50], parts[1][:50], parts[2][:50], parts[3][:50])
    user_first = f"{first} {father}".strip()[:50]
    user_last = f"{last} {fourth}".strip()[:50]
    return first, father, last, fourth, user_first, user_last


def omit_spaces(value: str) -> str:
    return str(value or "").replace(" ", "")


def staff_agent_email(staff: Staff, agent_first_name: str) -> str:
    local = omit_spaces(agent_first_name).lower() or "agent"
    emp = omit_spaces(staff.employee_id) or str(staff.pk)
    email = f"{local}@{emp}.com"
    if len(email) > 50:
        email = f"{local[:12]}@{emp}.com"[:50]
    if User.objects.filter(email__iexact=email).exists():
        email = f"{local}@{emp}.{staff.pk}.com"[:50]
    return email


def find_staff_by_employee_id(employee_id: str) -> Staff | None:
    employee_id = (employee_id or "").strip()
    if not employee_id:
        return None
    staff = Staff.objects.filter(employee_id=employee_id).first()
    if staff:
        return staff
    if employee_id.isdigit():
        for value in exact_numeric_variants(employee_id):
            staff = Staff.objects.filter(employee_id=value).first()
            if staff:
                return staff
    return None


def agent_exists_for_staff(staff: Staff) -> bool:
    q = staff_agent_lookup_q(staff)
    return bool(q) and Agent.objects.filter(q).exclude(user__is_superuser=True).exists()


def validate_profile(picture) -> str | None:
    if not picture:
        return "Profile photo is required"
    name = getattr(picture, "name", "") or ""
    content = getattr(picture, "content_type", "") or ""
    size = getattr(picture, "size", 0) or 0
    name_ok = name.lower().endswith((".jpg", ".jpeg", ".png"))
    type_ok = content in ALLOWED_CONTENT or content.startswith("image/")
    if not name_ok and not type_ok:
        return "Only JPG or PNG images are allowed"
    if size > MAX_PROFILE_BYTES:
        return "Image must be 2.5MB or smaller"
    return None


def next_agent_username() -> str:
    base = "AG"
    # Prefer sequential AG#### from existing usernames; fall back to count.
    last = (
        User.objects.filter(username__startswith="AG")
        .order_by("-id")
        .values_list("username", flat=True)
        .first()
    )
    n = 1
    if last and len(last) > 2 and last[2:].isdigit():
        n = int(last[2:]) + 1
    else:
        n = User.objects.filter(is_agent=True).count() + 1
    while User.objects.filter(username=f"{base}{n:04d}").exists():
        n += 1
    return f"{base}{n:04d}"


@transaction.atomic
def create_agent_from_staff(
    *,
    employee_id: str,
    gender: str,
    county_id: str | int | None,
    profile,
    recorded_by,
) -> tuple[Agent, User]:
    staff = find_staff_by_employee_id(employee_id)
    if not staff:
        raise ValueError("Staff record not found")
    if agent_exists_for_staff(staff):
        raise ValueError("An agent already exists for this employee")

    phone = (staff.number or "").strip()
    if not phone:
        raise ValueError("Staff record has no phone number")
    if User.objects.filter(Q(phone=phone) | Q(phone=phone.replace(" ", ""))).exists():
        raise ValueError(f"A user with phone {phone} already exists")

    err = validate_profile(profile)
    if err:
        raise ValueError(err)

    gender = gender if gender in ("Male", "Female") else "Male"
    first, father, last, fourth, user_first, user_last = split_staff_name(staff.name)
    nickname = (staff.employee_id or "").strip()
    email = staff_agent_email(staff, first)
    username = next_agent_username()

    county = None
    if county_id:
        county = County.objects.filter(pk=county_id).first()
        if not county:
            raise ValueError("Invalid county selected")

    directorate = Directorate.objects.order_by("pk").first()

    user = User.objects.create_user(
        email=email,
        username=username,
        password=phone.replace(" ", ""),
        first_name=user_first,
        last_name=user_last,
        phone=phone,
        gender=gender,
        is_agent=True,
        is_active=True,
        county=county,
        directorate=directorate,
    )
    if profile:
        user.profile = profile
        user.save(update_fields=["profile"])

    # Default Ilaalo-Shacab-like group if present
    group = Group.objects.filter(name__icontains="Ilaalo").first() or Group.objects.filter(name__icontains="Shacab").first()
    if group:
        user.groups.add(group)

    if hasattr(profile, "seek"):
        profile.seek(0)

    agent = Agent.objects.create(
        user=user,
        service_id=None,
        first_name=first,
        father_name=father,
        last_name=last,
        fourth_name=fourth,
        mother_name="N/A",
        nickname=nickname,
        date_of_birth=DEFAULT_AGENT_DOB,
        gender=gender,
        phone=phone,
        email=email,
        present="Joogey",
        status="Active",
        profile=profile,
        biography="N/A",
        county=county,
        directorate=directorate,
        recorded_by=recorded_by,
    )
    return agent, user
