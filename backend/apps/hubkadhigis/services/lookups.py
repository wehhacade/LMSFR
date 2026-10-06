from apps.hubkadhigis.models import ForceUnit, Rank, SurrenderLocation, WeaponType

DEFAULT_RANKS = ("Askari", "Koorborol", "Sarjaan", "Lieftenant", "Kaabtaan", "Meejor")
DEFAULT_FORCE_UNITS = ("Booliska", "Ciidanka Xoogga", "NISA", "Daraawiishta")
DEFAULT_WEAPON_TYPES = ("Rifle", "Pistol", "SMG", "Shotgun", "Explosive", "Other")
DEFAULT_SURRENDER_LOCATIONS = ("Hodan", "Wadajir", "Bakaaro", "Yaqshid", "Hamarweyne", "Other")

LOOKUP_SEED_DATA = (
    (DEFAULT_RANKS, Rank),
    (DEFAULT_FORCE_UNITS, ForceUnit),
    (DEFAULT_WEAPON_TYPES, WeaponType),
    (DEFAULT_SURRENDER_LOCATIONS, SurrenderLocation),
)


def seed_lookup_tables() -> int:
    """Create missing lookup rows. Returns count of newly created rows."""
    created = 0
    for names, model in LOOKUP_SEED_DATA:
        for name in names:
            _, was_created = model.objects.get_or_create(name=name)
            if was_created:
                created += 1
    return created
