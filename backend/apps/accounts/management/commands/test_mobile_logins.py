"""
Batch-test TipPhone / mobile login for a list of employee numbers.

Shows last-4, login email, and the password that actually works
(phone, if that is still the password). Does not invent unknown hashes.

Usage:
    python manage.py test_mobile_logins 230967875 20561563 200268645
    python manage.py test_mobile_logins --file emp.txt
"""

from __future__ import annotations

from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from rest_framework.test import APIClient

from apps.accounts.models import Agent
from apps.accounts.views.mobile_auth import _resolve_login_user

User = get_user_model()


def _phone_candidates(phone: str) -> list[str]:
    raw = (phone or "").strip()
    if not raw:
        return []
    digits = "".join(ch for ch in raw if ch.isdigit())
    out: list[str] = []
    for item in (raw, digits, digits.lstrip("0") if digits else ""):
        if item and item not in out:
            out.append(item)
    return out


def _find_agent(emp: str) -> Agent | None:
    emp = emp.strip()
    if not emp:
        return None
    qs = Agent.objects.select_related("user", "user__county")
    agent = qs.filter(nickname=emp).first()
    if agent:
        return agent
    if not emp.startswith("0"):
        agent = qs.filter(nickname=f"0{emp}").first()
        if agent:
            return agent
    return qs.filter(
        Q(nickname__endswith=emp) | Q(nickname__icontains=emp)
    ).first()


class Command(BaseCommand):
    help = "Test last-4 mobile login for many employee numbers at once."

    def add_arguments(self, parser):
        parser.add_argument(
            "emp",
            nargs="*",
            help="Employee numbers (nickname), one or many.",
        )
        parser.add_argument(
            "--file",
            dest="emp_file",
            help="Text file with one employee number per line.",
        )

    def handle(self, *args, **options):
        emps: list[str] = list(options.get("emp") or [])
        emp_file = options.get("emp_file")
        if emp_file:
            path = Path(emp_file)
            if not path.exists():
                raise CommandError(f"File ma jiro: {emp_file}")
            emps.extend(
                line.strip()
                for line in path.read_text().splitlines()
                if line.strip() and not line.strip().startswith("#")
            )
        emps = [e for e in emps if e]
        if not emps:
            raise CommandError(
                "Geli EMP numbers: python manage.py test_mobile_logins 20561563 230967875"
            )

        client = APIClient()
        ok = fail = missing = 0
        self.stdout.write(
            f"{'EMP':<14} {'4-digit':<8} {'user (email)':<34} {'password':<14} {'4-login':<8} {'email-login':<12} natiijo"
        )
        self.stdout.write("-" * 120)

        for emp in emps:
            agent = _find_agent(emp)
            if not agent or not agent.user_id:
                missing += 1
                self.stdout.write(self.style.WARNING(f"{emp:<14} {'—':<8} {'lama helin':<34}"))
                continue
            user = agent.user
            nick = (agent.nickname or "").strip()
            last4 = nick[-4:] if len(nick) >= 4 and nick[-4:].isdigit() else ""
            email = (user.email or user.username or "").strip()
            resolved = _resolve_login_user(last4) if last4 else None
            password = ""
            for candidate in _phone_candidates(user.phone or agent.phone or ""):
                if user.check_password(candidate):
                    password = candidate
                    break

            four_status = "—"
            email_status = "—"
            if password and last4:
                four = client.post(
                    "/api/v3/mobile/login/",
                    {"username": last4, "password": password},
                    format="json",
                )
                four_status = str(four.status_code)
            if password and email:
                email_login = client.post(
                    "/api/v3/mobile/login/",
                    {"username": email, "password": password},
                    format="json",
                )
                email_status = str(email_login.status_code)

            if not last4:
                reason = "EMP ma dhammaado 4 lambar"
            elif resolved is None:
                reason = "4-digit ma xirmo (duplicate ama ma jiro)"
            elif resolved.pk != user.pk:
                reason = f"4-digit wuxuu xiray user kale {resolved.pk}"
            elif not password:
                reason = "password ma aha phone — lama tijaabin karo"
            elif four_status == "200":
                reason = "OK"
            else:
                reason = f"4-digit login {four_status}"

            if reason == "OK":
                ok += 1
                style = self.style.SUCCESS
            else:
                fail += 1
                style = self.style.ERROR

            shown_pass = password or "lama ogaan"
            self.stdout.write(
                style(
                    f"{nick or emp:<14} {last4 or '—':<8} {email[:33]:<34} "
                    f"{shown_pass:<14} {four_status:<8} {email_status:<12} {reason}"
                )
            )

        self.stdout.write("-" * 120)
        self.stdout.write(f"OK {ok}  FAIL {fail}  MAQAN {missing}  TOTAL {len(emps)}")
        self.stdout.write(
            "Password-ka la tusay waa phone-ka kaliya haddii uu weli password-ka dhabta ah yahay."
        )
