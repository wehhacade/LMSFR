"""
Import legacy phpMyAdmin SQL dumps into PostgreSQL v3.

Usage:
  python manage.py import_legacy list
  python manage.py import_legacy users
  python manage.py import_legacy directorate
  make import-directorate
"""

from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.core.legacy_import.auth_groups import (
    import_auth_group,
    import_auth_group_permissions,
    import_auth_groups_bundle,
    import_users_groups,
    truncate_auth_groups,
)
from apps.core.legacy_import.generic import import_model_rows
from apps.core.legacy_import.registry import (
    all_legacy_tables,
    model_for_table,
    resolve_table,
    sql_file_candidates,
)
from apps.core.legacy_import.sql_dump import load_sql_file, parse_insert_rows
from apps.core.legacy_import.agents import import_agents
from apps.core.legacy_import.damiinada import import_damiinada
from apps.core.legacy_import.suspectcase import import_suspectcase
from apps.core.legacy_import.suspects import import_suspects
from apps.core.legacy_import.survey_answers import import_surveys_answer_choices
from apps.core.legacy_import.users import import_users
from apps.dhacdooyinka.services.faahfaahin import backfill_tafaasiisha_from_faahfaahinta

CUSTOM_IMPORTERS = {
    "users": import_users,
    "agents": import_agents,
    "suspects": import_suspects,
    "damiinada": import_damiinada,
    "suspectcase": import_suspectcase,
    "auth_group": import_auth_group,
    "auth_group_permissions": import_auth_group_permissions,
    "users_groups": import_users_groups,
    "surveys_answer_choices": import_surveys_answer_choices,
}

BUNDLE_IMPORTERS = {
    "auth_groups": (
        ("auth_group", "auth_group.sql"),
        ("auth_group_permissions", "auth_group_permissions.sql"),
        ("users_groups", "users_groups.sql"),
    ),
    "auth-groups": (
        ("auth_group", "auth_group.sql"),
        ("auth_group_permissions", "auth_group_permissions.sql"),
        ("users_groups", "users_groups.sql"),
    ),
}


def _data_dir() -> Path:
    return Path(settings.BASE_DIR) / "data"


def _find_sql_file(table: str, sql_file: str | None) -> Path:
    if sql_file:
        path = Path(sql_file)
        if not path.is_file():
            raise CommandError(f"SQL file not found: {path}")
        return path

    data = _data_dir()
    split_dir = data / "split"
    tried: list[str] = []
    for name in sql_file_candidates(table):
        for path in (data / f"{name}.sql", split_dir / f"{name}.sql"):
            tried.append(str(path))
            if path.is_file():
                return path

    resolved = resolve_table(table)
    raise CommandError(
        f"SQL file not found for `{table}` (→ `{resolved}`).\n"
        f"Tried: {', '.join(tried)}\n"
        f"Save phpMyAdmin export as data/{resolved}.sql or data/split/{resolved}.sql"
    )


class Command(BaseCommand):
    help = "Import legacy SQL dump by table name (make import-<table>)."

    def add_arguments(self, parser):
        parser.add_argument(
            "table",
            nargs="?",
            help="Table name or alias (users, directorate, suspects, …)",
        )
        parser.add_argument("--sql-file", help="Override SQL file path")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--truncate", action="store_true")
        parser.add_argument("--limit", type=int, default=0)
        parser.add_argument("--batch-size", type=int, default=200)

    def handle(self, *args, **options):
        raw_table = (options.get("table") or "").strip().lower()

        if not raw_table or raw_table == "list":
            self._print_list()
            return

        if raw_table in ("all", "*"):
            self._import_all(options)
            return

        if raw_table in BUNDLE_IMPORTERS:
            self._import_bundle(raw_table, options)
            return

        table = resolve_table(raw_table)
        model = model_for_table(raw_table)
        if model is None and table not in CUSTOM_IMPORTERS:
            known = ", ".join(t["table"] for t in all_legacy_tables()[:12])
            raise CommandError(
                f"Unknown table `{raw_table}` (resolved: `{table}`). "
                f"Run `import_legacy list`. Examples: {known}…"
            )

        self._import_one(raw_table, options)

    def _import_all(self, options: dict) -> None:
        """Import every split/*.sql table that maps to a v3 model or custom importer."""
        split_dir = _data_dir() / "split"
        if not split_dir.is_dir():
            raise CommandError(f"Missing {split_dir}. Run make load-prod-dump first (split step).")

        names = sorted(p.stem for p in split_dir.glob("*.sql"))
        # Prefer dependency-friendly order for known aliases first.
        priority = [
            "region",
            "county",
            "sub_county",
            "people_section",
            "accounts_directorate",
            "accounts_qaybta",
            "user_type",
            "users",
            "auth_group",
            "auth_group_permissions",
            "users_groups",
            "darajooyin",
            "ciidanka",
            "nuucahubka",
            "goobtalaguwareejiyey",
            "hubkadhigis",
            "hubkadhigis_images",
            "noocadhacdooyinkaguud",
            "noocyada_dhacdooyinka",
            "dhacdooyinka",
            "faahfaahinta",
            "dhibanayaashas",
            "dhibane_documents",
            "suspectstatus",
            "suspects",
            "suspectcase",
            "damiinada",
            "suspectresponse",
            "fcmtoken",
            "notices",
            "agents",
            "staff",
            "surveys_survey",
            "surveys_surveysection",
            "surveys_question",
            "surveys_choice",
            "surveys_response",
            "surveys_answer",
            "surveys_answer_choices",
        ]
        ordered = [n for n in priority if n in names]
        ordered.extend(n for n in names if n not in ordered)

        imported = skipped_unknown = 0
        for name in ordered:
            if name in ("auth_group", "auth_group_permissions", "users_groups") or name.startswith("django_"):
                continue

            model = model_for_table(name)
            table = resolve_table(name)
            if model is None and table not in CUSTOM_IMPORTERS:
                skipped_unknown += 1
                self.stdout.write(f"— skip unmapped `{name}` (use make import-raw-legacy)")
                continue

            self.stdout.write("")
            self.stdout.write(self.style.NOTICE(f"======== {name} ========"))
            try:
                self._import_one(name, options)
                imported += 1
            except CommandError as exc:
                self.stdout.write(self.style.WARNING(f"⚠️  {name}: {exc}"))

        # auth groups bundle (expects files under data/)
        for fname in ("auth_group.sql", "auth_group_permissions.sql", "users_groups.sql"):
            src = split_dir / fname
            dst = _data_dir() / fname
            if src.is_file():
                dst.write_bytes(src.read_bytes())
        if (_data_dir() / "auth_group.sql").is_file():
            self.stdout.write("")
            self.stdout.write(self.style.NOTICE("======== auth-groups ========"))
            try:
                self._import_bundle("auth-groups", options)
                imported += 1
            except CommandError as exc:
                self.stdout.write(self.style.WARNING(f"⚠️  auth-groups: {exc}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"\nimport_legacy all done — imported={imported} unmapped_split_files={skipped_unknown}"
            )
        )

    def _import_one(self, raw_table: str, options: dict) -> None:
        table = resolve_table(raw_table)
        model = model_for_table(raw_table)
        if model is None and table not in CUSTOM_IMPORTERS:
            raise CommandError(f"Unknown table `{raw_table}`")

        sql_path = _find_sql_file(raw_table, options.get("sql_file"))
        self.stdout.write(f"Parsing {sql_path} → `{table}` …")
        rows = parse_insert_rows(load_sql_file(sql_path), table)
        # Also try parsing with the raw dump table name (e.g. hubkadhigis)
        if not rows:
            rows = parse_insert_rows(load_sql_file(sql_path), raw_table)
        if options["limit"]:
            rows = rows[: int(options["limit"])]

        if not rows:
            raise CommandError(f"No INSERT rows for `{table}` in {sql_path}")

        self.stdout.write(self.style.SUCCESS(f"Parsed {len(rows)} rows"))

        if options["dry_run"]:
            sample = rows[0]
            self.stdout.write(f"Columns: {', '.join(list(sample.keys())[:20])}")
            self.stdout.write(f"Sample id={sample.get('id')}")
            if model:
                self.stdout.write(f"Model: {model._meta.app_label}.{model.__name__}")
            return

        importer = CUSTOM_IMPORTERS.get(table, import_model_rows)
        if table in CUSTOM_IMPORTERS:
            result = importer(rows, truncate=options["truncate"], batch_size=options["batch_size"])
        else:
            result = importer(
                model,
                rows,
                truncate=options["truncate"],
                batch_size=options["batch_size"],
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Import complete — "
                f"created={result['created']} updated={result['updated']} "
                f"skipped={result['skipped']} max_id={result.get('max_id', '—')}"
            )
        )
        if table == "faahfaahinta":
            filled = backfill_tafaasiisha_from_faahfaahinta()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Backfilled tafaasiisha_goobta_dhacdada on {filled} dhacdooyinka rows"
                )
            )

    def _import_bundle(self, bundle: str, options: dict) -> None:
        data = _data_dir()
        steps = BUNDLE_IMPORTERS[bundle]
        rows_by_table: dict[str, list[dict]] = {}

        for table, filename in steps:
            sql_path = data / filename
            if not sql_path.is_file():
                raise CommandError(f"SQL file not found: {sql_path}")
            self.stdout.write(f"Parsing {sql_path} → `{table}` …")
            rows = parse_insert_rows(load_sql_file(sql_path), table)
            if options["limit"]:
                rows = rows[: int(options["limit"])]
            if not rows:
                raise CommandError(f"No INSERT rows for `{table}` in {sql_path}")
            self.stdout.write(self.style.SUCCESS(f"  {table}: {len(rows)} rows"))
            rows_by_table[table] = rows

        if options["dry_run"]:
            for table, rows in rows_by_table.items():
                sample = rows[0]
                self.stdout.write(f"{table} columns: {', '.join(list(sample.keys())[:12])}")
            return

        if options["truncate"]:
            truncated = truncate_auth_groups()
            self.stdout.write(self.style.WARNING(f"Truncated — {', '.join(truncated)}"))

        result = import_auth_groups_bundle(
            group_rows=rows_by_table["auth_group"],
            permission_rows=rows_by_table["auth_group_permissions"],
            users_group_rows=rows_by_table["users_groups"],
            truncate=False,
            batch_size=options["batch_size"],
        )

        for key, stats in result.items():
            self.stdout.write(
                self.style.SUCCESS(
                    f"{key} — created={stats['created']} skipped={stats['skipped']} "
                    f"max_id={stats.get('max_id', '—')}"
                )
            )

    def _print_list(self) -> None:
        data = _data_dir()
        self.stdout.write("Import: make import-<table>   or   make import-legacy table=<name>\n")
        self.stdout.write("Bundles: make import-auth-groups-fresh\n")
        self.stdout.write(f"SQL files: {data}/<name>.sql\n\n")

        custom = set(CUSTOM_IMPORTERS) | set(BUNDLE_IMPORTERS)
        for entry in all_legacy_tables():
            t = entry["table"]
            found = any((data / f"{n}.sql").is_file() for n in sql_file_candidates(t))
            flag = "✓ sql" if found else "— sql"
            kind = "custom" if t in custom else "auto"
            self.stdout.write(f"  {t:22} {entry['model']:35} {flag:8} [{kind}]")
