"""Unique code generators — mirrors old SC/DA prefixes."""


def generate_damiin_code() -> str:
    from .models import Damiinada

    last = Damiinada.objects.exclude(code="").order_by("code").values_list("code", flat=True).last()
    if not last or len(last) < 3:
        return "DA00001"
    try:
        num = int(last[2:]) + 1
    except ValueError:
        num = 1
    return f"DA{num:05d}"


def generate_case_code() -> str:
    from .models import SuspectCase

    last = SuspectCase.objects.exclude(case_code="").order_by("case_code").values_list("case_code", flat=True).last()
    if not last or len(last) < 3:
        return "SC00001"
    try:
        num = int(last[2:]) + 1
    except ValueError:
        num = 1
    return f"SC{num:05d}"
