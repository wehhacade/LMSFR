"""Extract dhacdooyinka-related tables from the phpMyAdmin dump into data/split/."""

from __future__ import annotations

import re
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent
DUMP = DATA_DIR / "lmsbr_prod_latest.sql"
SPLIT_DIR = DATA_DIR / "split"

TABLES = {
    "noocadhacdooyinkaguud",
    "noocyada_dhacdooyinka",
    "dhacdooyinka",
    "faahfaahinta",
    "dhibanayaashas",
    "dhibane_documents",
    "dhacdooyinka_dhacdodocuments",
}

TABLE_START_RE = re.compile(
    r"^(?:CREATE TABLE|INSERT INTO|DROP TABLE IF EXISTS|ALTER TABLE|LOCK TABLES)\s+`?([A-Za-z0-9_]+)`?",
    re.IGNORECASE,
)


def main() -> None:
    if not DUMP.is_file():
        raise SystemExit(f"Dump not found: {DUMP}")
    SPLIT_DIR.mkdir(parents=True, exist_ok=True)
    writers: dict[str, object] = {}
    current: str | None = None
    counts = {name: 0 for name in TABLES}

    with DUMP.open("r", encoding="utf-8", errors="replace", newline="") as src:
        for line in src:
            match = TABLE_START_RE.match(line)
            if match:
                current = match.group(1).strip("`").lower()
            if current not in TABLES:
                continue
            if current not in writers:
                path = SPLIT_DIR / f"{current}.sql"
                writers[current] = path.open("w", encoding="utf-8", newline="\n")
            writers[current].write(line)
            counts[current] += 1

    for fh in writers.values():
        fh.close()

    print("Extracted:")
    for name in sorted(TABLES):
        path = SPLIT_DIR / f"{name}.sql"
        size = path.stat().st_size if path.is_file() else 0
        print(f"  {name:32} lines={counts[name]:7}  bytes={size}")


if __name__ == "__main__":
    main()
