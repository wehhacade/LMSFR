"""One-off parser: reads sub_county INSERT lines from stdin, writes legacy_sub_counties.json."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def parse_rows(text: str) -> list[list]:
    pattern = re.compile(
        r"\(\s*(\d+)\s*,\s*(?:'([^']*)'|NULL)\s*,\s*(?:'((?:\\'|[^'])*)'|NULL)\s*,\s*(?:'((?:\\'|[^'])*)'|NULL)\s*,\s*(\d+)\s*\)"
    )
    rows: dict[int, list] = {}
    for m in pattern.finditer(text):
        legacy_id = int(m.group(1))
        code = (m.group(2) or "").replace("\\'", "'")
        name = (m.group(3) or "").replace("\\'", "'")
        desc = (m.group(4) or "").replace("\\'", "'")
        county_id = int(m.group(5))
        rows[legacy_id] = [legacy_id, code, name, desc, county_id]
    return [rows[k] for k in sorted(rows)]


def main() -> None:
    text = sys.stdin.read()
    rows = parse_rows(text)
    out = Path(__file__).with_name("legacy_sub_counties.json")
    out.write_text(json.dumps(rows, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(rows)} rows to {out}")


if __name__ == "__main__":
    main()
