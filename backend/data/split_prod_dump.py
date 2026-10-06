#!/usr/bin/env python3
"""Split a phpMyAdmin MySQL dump into per-table SQL files.

Writes:
  data/split/<table>.sql          — every table from the dump
  data/<alias>.sql                — copies used by `import_legacy`

Usage (inside Django container or host with the dump path):
  python data/split_prod_dump.py
  python data/split_prod_dump.py /app/data/lmsbr_prod_latest.sql
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent
SPLIT_DIR = DATA_DIR / "split"
DEFAULT_DUMP = DATA_DIR / "lmsbr_prod_latest.sql"

# Tables import_legacy expects under data/<name>.sql
IMPORT_COPIES: dict[str, list[str]] = {
    "users": ["users"],
    "region": ["region", "regions"],
    "county": ["county", "counties"],
    "sub_county": ["sub_county", "subcounty", "sub_counties"],
    "accounts_directorate": ["accounts_directorate", "directorate", "directorates"],
    "accounts_qaybta": ["accounts_qaybta", "department", "departments", "qaybta"],
    "user_type": ["user_type", "user_types"],
    "auth_group": ["auth_group"],
    "auth_group_permissions": ["auth_group_permissions"],
    "users_groups": ["users_groups"],
    "suspects": ["suspects"],
    "suspectcase": ["suspectcase"],
    "damiinada": ["damiinada"],
    "suspectstatus": ["suspectstatus"],
    "suspectresponse": ["suspectresponse"],
    "fcmtoken": ["fcmtoken"],
    "notices": ["notices"],
    "agents": ["agents"],
    "staff": ["staff"],
    "people_section": ["people_section", "people_sections", "section", "sections"],
    # Hub-Kadhigis
    "hubkadhigis": ["hubkadhigis", "disarmament_records"],
    "hubkadhigis_images": ["hubkadhigis_images", "disarmament_images"],
    "nuucahubka": ["nuucahubka", "weapon_types"],
    "ciidanka": ["ciidanka", "force_units"],
    "darajooyin": ["darajooyin", "disarmament_ranks"],
    "goobtalaguwareejiyey": ["goobtalaguwareejiyey", "surrender_locations"],
    # Dhacdooyinka
    "noocadhacdooyinkaguud": ["noocadhacdooyinkaguud"],
    "noocyada_dhacdooyinka": ["noocyada_dhacdooyinka"],
    "dhacdooyinka": ["dhacdooyinka"],
    "faahfaahinta": ["faahfaahinta"],
    "dhibanayaashas": ["dhibanayaashas"],
    "dhibane_documents": ["dhibane_documents"],
    "dhacdooyinka_dhacdodocuments": ["dhacdooyinka_dhacdodocuments"],
    # Surveys
    "surveys_survey": ["surveys_survey"],
    "surveys_surveysection": ["surveys_surveysection"],
    "surveys_question": ["surveys_question"],
    "surveys_choice": ["surveys_choice"],
    "surveys_response": ["surveys_response"],
    "surveys_answer": ["surveys_answer"],
    "surveys_answer_choices": ["surveys_answer_choices"],
}

TABLE_START_RE = re.compile(
    r"^(?:CREATE TABLE|INSERT INTO|DROP TABLE IF EXISTS|ALTER TABLE|LOCK TABLES)\s+`?([A-Za-z0-9_]+)`?",
    re.IGNORECASE,
)


def normalize_table(name: str) -> str:
    return name.strip().strip("`\"'").lower()


def split_dump(dump_path: Path) -> dict[str, Path]:
    if not dump_path.is_file():
        raise SystemExit(f"Dump not found: {dump_path}")

    SPLIT_DIR.mkdir(parents=True, exist_ok=True)
    for old in SPLIT_DIR.glob("*.sql"):
        old.unlink()

    current: str | None = None
    handles: dict[str, object] = {}
    written: dict[str, Path] = {}
    line_count = 0

    try:
        with dump_path.open("r", encoding="utf-8", errors="replace") as src:
            for raw in src:
                line_count += 1
                stripped = raw.strip()
                match = TABLE_START_RE.match(stripped)
                if match:
                    table = normalize_table(match.group(1))
                    if table != current:
                        current = table
                        if table not in handles:
                            out = SPLIT_DIR / f"{table}.sql"
                            handles[table] = out.open("w", encoding="utf-8")
                            written[table] = out
                            print(f"  → {out.name}")
                if current and current in handles:
                    handles[current].write(raw)
                if line_count % 500_000 == 0:
                    print(f"  … scanned {line_count:,} lines, {len(written)} tables")
    finally:
        for fh in handles.values():
            fh.close()

    print(f"Split complete: {len(written)} tables from {line_count:,} lines")
    return written


def copy_for_import(written: dict[str, Path]) -> None:
    copied = 0
    for dump_table, aliases in IMPORT_COPIES.items():
        src = written.get(dump_table)
        if src is None:
            continue
        for alias in aliases:
            dest = DATA_DIR / f"{alias}.sql"
            dest.write_bytes(src.read_bytes())
            copied += 1
    print(f"Copied {copied} import_legacy SQL files into {DATA_DIR}")


def main() -> None:
    dump = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DUMP
    print(f"Splitting {dump} …")
    written = split_dump(dump)
    copy_for_import(written)


if __name__ == "__main__":
    main()
