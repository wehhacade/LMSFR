"""Parse phpMyAdmin INSERT dumps (MySQL) into row dicts."""

from __future__ import annotations

import re
from pathlib import Path

from apps.core.legacy_import.registry import sql_table_matches

_INSERT_RE = re.compile(
    r"INSERT\s+INTO\s+[`'\"]?(\w+)[`'\"]?\s*\((?P<cols>[^)]+)\)\s*VALUES\s*",
    re.IGNORECASE,
)


def _split_columns(cols_raw: str) -> list[str]:
    return [c.strip().strip("`'\"") for c in cols_raw.split(",")]


def _unescape_mysql_string(value: str) -> str:
    out: list[str] = []
    i = 0
    while i < len(value):
        ch = value[i]
        if ch == "\\" and i + 1 < len(value):
            nxt = value[i + 1]
            mapping = {"n": "\n", "r": "\r", "t": "\t", "\\": "\\", "'": "'", '"': '"'}
            out.append(mapping.get(nxt, nxt))
            i += 2
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def _parse_value(token: str):
    token = token.strip()
    if not token or token.upper() == "NULL":
        return None
    if token.startswith("'") and token.endswith("'"):
        return _unescape_mysql_string(token[1:-1])
    if token.startswith('"') and token.endswith('"'):
        return _unescape_mysql_string(token[1:-1])
    if re.fullmatch(r"-?\d+", token):
        return int(token)
    if re.fullmatch(r"-?\d+\.\d+", token):
        return float(token)
    return token


def _split_row_tokens(row_inner: str) -> list[str]:
    tokens: list[str] = []
    buf: list[str] = []
    in_str: str | None = None
    escape = False

    for ch in row_inner:
        if in_str:
            buf.append(ch)
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == in_str:
                in_str = None
            continue

        if ch in ("'", '"'):
            in_str = ch
            buf.append(ch)
            continue

        if ch == ",":
            tokens.append("".join(buf).strip())
            buf = []
            continue

        buf.append(ch)

    if buf:
        tokens.append("".join(buf).strip())
    return tokens


def _strip_row_line(line: str) -> str | None:
    inner = line.strip()
    if not inner.startswith("("):
        return None
    if inner.endswith(");"):
        inner = inner[:-2]
    elif inner.endswith("),"):
        inner = inner[:-2]
    elif inner.endswith(")"):
        inner = inner[:-1]
    else:
        return None
    return inner[1:]


def parse_insert_rows(sql_text: str, table: str) -> list[dict]:
    """Parse INSERT rows for a v3 table (matches legacy MySQL table names too)."""
    rows: list[dict] = []
    columns: list[str] | None = None
    active = False

    for raw_line in sql_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if line.upper().startswith("INSERT INTO"):
            match = _INSERT_RE.search(line)
            if match and sql_table_matches(table, match.group(1)):
                columns = _split_columns(match.group("cols"))
                active = True
            else:
                active = False
                columns = None
            continue

        if not active or columns is None:
            continue

        inner = _strip_row_line(line)
        if inner is None:
            continue

        parts = _split_row_tokens(inner)
        if len(parts) != len(columns):
            pk = parts[0] if parts else "?"
            raise ValueError(
                f"Column/value mismatch for {table} id={pk}: "
                f"{len(columns)} cols vs {len(parts)} values"
            )
        rows.append({col: _parse_value(val) for col, val in zip(columns, parts)})

    if rows:
        return rows

    streamed = _parse_insert_rows_streaming(sql_text, table)
    if streamed:
        return streamed

    # Fallback: single-table dump with a different INSERT name — take first INSERT block
    return _parse_first_insert_block(sql_text)


def _parse_insert_rows_streaming(sql_text: str, table: str) -> list[dict]:
    """Parse INSERT tuples even when quoted longtext spans multiple lines."""
    rows: list[dict] = []
    columns: list[str] | None = None
    collecting = False
    in_str: str | None = None
    escape = False
    buf = ""
    target = table.lower()

    def flush_row(inner: str) -> None:
        if not columns:
            return
        parts = _split_row_tokens(inner)
        if len(parts) != len(columns):
            return
        rows.append({col: _parse_value(val) for col, val in zip(columns, parts)})

    i = 0
    upper = sql_text.upper()
    while i < len(sql_text):
        if not collecting:
            idx = upper.find("INSERT INTO", i)
            if idx < 0:
                break
            rest = sql_text[idx + len("INSERT INTO") :].lstrip()
            name = rest.split(None, 1)[0].strip("`'\"")
            if name.lower() != target and not sql_table_matches(table, name):
                i = idx + len("INSERT INTO")
                continue
            paren = rest.find("(")
            if paren < 0:
                break
            close = rest.find(")", paren)
            if close < 0:
                break
            columns = _split_columns(rest[paren + 1 : close])
            values_at = rest.upper().find("VALUES", close)
            if values_at < 0:
                break
            collecting = True
            in_str = None
            escape = False
            buf = ""
            i = idx + len("INSERT INTO") + values_at + len("VALUES")
            continue

        ch = sql_text[i]
        if in_str:
            buf += ch
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == in_str:
                in_str = None
            i += 1
            continue
        if ch in ("'", '"'):
            in_str = ch
            buf += ch
            i += 1
            continue
        if ch == "(":
            buf = ""
            i += 1
            continue
        if ch == ")":
            flush_row(buf)
            buf = ""
            i += 1
            continue
        if ch == ";" and not buf.strip():
            collecting = False
            columns = None
            i += 1
            continue
        buf += ch
        i += 1

    return rows


def _parse_first_insert_block(sql_text: str) -> list[dict]:
    """Parse all INSERT statements of the first table found (single-table dumps)."""
    rows: list[dict] = []
    columns: list[str] | None = None
    first_table: str | None = None

    for raw_line in sql_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if line.upper().startswith("INSERT INTO"):
            match = _INSERT_RE.search(line)
            if not match:
                continue
            if first_table is None:
                first_table = match.group(1).lower()
            elif match.group(1).lower() != first_table:
                break
            columns = _split_columns(match.group("cols"))
            continue

        if columns is None:
            continue

        inner = _strip_row_line(line)
        if inner is None:
            continue

        parts = _split_row_tokens(inner)
        if len(parts) != len(columns):
            continue
        rows.append({col: _parse_value(val) for col, val in zip(columns, parts)})

    return rows


def load_sql_file(path: str | Path) -> str:
    return Path(path).read_text(encoding="utf-8", errors="replace")
