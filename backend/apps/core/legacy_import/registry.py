"""Resolve legacy MySQL table names to Django models."""

from __future__ import annotations

from django.apps import apps
from django.db import models

# CLI / make alias → v3 db_table
TABLE_ALIASES: dict[str, str] = {
    "directorate": "directorates",
    "directorates": "directorates",
    "qaybta": "departments",
    "department": "departments",
    "departments": "departments",
    "user_type": "user_types",
    "user_types": "user_types",
    "accounts_directorate": "directorates",
    "accounts_qaybta": "departments",
    "county": "counties",
    "counties": "counties",
    "subcounty": "sub_counties",
    "sub_county": "sub_counties",
    "sub_counties": "sub_counties",
    "region": "regions",
    "regions": "regions",
    "people_section": "people_sections",
    "people_sections": "people_sections",
    "section": "people_sections",
    "sections": "people_sections",
    # Hub-Kadhigis (legacy MySQL names → v3)
    "hubkadhigis": "disarmament_records",
    "hubkadhigis_images": "disarmament_images",
    "nuucahubka": "weapon_types",
    "ciidanka": "force_units",
    "darajooyin": "disarmament_ranks",
    "goobtalaguwareejiyey": "surrender_locations",
}

# Old phpMyAdmin INSERT table names → v3 db_table
SQL_TABLE_ALIASES: dict[str, set[str]] = {
    "directorates": {"directorates", "accounts_directorate", "directorate"},
    "departments": {"departments", "accounts_qaybta", "qaybta"},
    "user_types": {"user_types", "user_type"},
    "users": {"users"},
    "regions": {"regions", "settings_regions", "accounts_region", "region"},
    "counties": {"counties", "settings_county", "accounts_county", "county"},
    "sub_counties": {
        "sub_counties",
        "settings_subcounty",
        "accounts_subcounty",
        "subcounty",
        "sub_county",
    },
    "suspects": {"suspects"},
    "suspectcase": {"suspectcase"},
    "suspectresponse": {"suspectresponse"},
    "damiinada": {"damiinada"},
    "suspectstatus": {"suspectstatus"},
    "fcmtoken": {"fcmtoken"},
    "notices": {"notices"},
    "people_sections": {"people_sections", "people_section", "sections", "section"},
    "disarmament_records": {"disarmament_records", "hubkadhigis"},
    "disarmament_images": {"disarmament_images", "hubkadhigis_images"},
    "weapon_types": {"weapon_types", "nuucahubka"},
    "force_units": {"force_units", "ciidanka"},
    "disarmament_ranks": {"disarmament_ranks", "darajooyin"},
    "surrender_locations": {"surrender_locations", "goobtalaguwareejiyey"},
    "surveys_survey": {"surveys_survey"},
    "surveys_surveysection": {"surveys_surveysection"},
    "surveys_question": {"surveys_question"},
    "surveys_choice": {"surveys_choice"},
    "surveys_response": {"surveys_response"},
    "surveys_answer": {"surveys_answer"},
    "dhibanayaashas": {"dhibanayaashas"},
    "dhibane_documents": {"dhibane_documents"},
    "dhacdooyinka_dhacdodocuments": {"dhacdooyinka_dhacdodocuments"},
    "dhacdooyinka": {"dhacdooyinka"},
    "faahfaahinta": {"faahfaahinta"},
    "noocadhacdooyinkaguud": {"noocadhacdooyinkaguud"},
    "noocyada_dhacdooyinka": {"noocyada_dhacdooyinka"},
}


def normalize_name(name: str) -> str:
    return name.lower().strip().replace("-", "_").strip("`'\"")


def resolve_table(name: str) -> str:
    key = normalize_name(name)
    return TABLE_ALIASES.get(key, key)


def sql_table_matches(target_table: str, sql_table: str) -> bool:
    target = resolve_table(target_table)
    sql_key = normalize_name(sql_table)
    allowed = SQL_TABLE_ALIASES.get(target, {target})
    if sql_key in allowed:
        return True
    if sql_key.rstrip("s") in allowed or f"{sql_key}s" in allowed:
        return True
    return sql_key == target


def model_for_table(table: str) -> type[models.Model] | None:
    target = resolve_table(table)
    for model in apps.get_models():
        if model._meta.db_table.lower() == target:
            return model
    return None


# Extra data/<file>.sql names (legacy export filenames)
SQL_FILE_ALIASES: dict[str, list[str]] = {
    "regions": ["region"],
    "counties": ["county"],
    "sub_counties": ["sub_county", "subcounty"],
    "disarmament_records": ["hubkadhigis"],
    "disarmament_images": ["hubkadhigis_images"],
    "weapon_types": ["nuucahubka"],
    "force_units": ["ciidanka"],
    "disarmament_ranks": ["darajooyin"],
    "surrender_locations": ["goobtalaguwareejiyey"],
    "people_sections": ["people_section", "section", "sections"],
}


def sql_file_candidates(table: str) -> list[str]:
    """Possible data/<name>.sql filenames for a table alias."""
    resolved = resolve_table(table)
    raw = normalize_name(table)
    names = [raw, resolved]
    names.extend(SQL_FILE_ALIASES.get(resolved, []))
    if resolved.endswith("s") and len(resolved) > 1:
        names.append(resolved[:-1])
    if not resolved.endswith("s"):
        names.append(f"{resolved}s")
    out: list[str] = []
    for n in names:
        if n not in out:
            out.append(n)
    return out


def all_legacy_tables() -> list[dict]:
    out: list[dict] = []
    for model in apps.get_models():
        table = model._meta.db_table
        if table:
            out.append(
                {
                    "table": table,
                    "model": f"{model._meta.app_label}.{model.__name__}",
                }
            )
    return sorted(out, key=lambda x: x["table"])
