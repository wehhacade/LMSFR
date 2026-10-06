"""Production region/county rows from lmsbr_prod_latest (MySQL dump)."""

REGIONS = (
    (1, "Banaadir", "BN", "Banaadir region"),
    (2, "Puntland", "PL", "Puntland region"),
    (3, "Hir-Shabeele", "HS", "Hir-Shabeele region"),
    (4, "Koonfur-Galbeed", "KG", "Koonfur-Galbeed region"),
    (5, "Gal-Mudug", "GM", "Gal-Mudug region"),
)

# (legacy_id, name, code, description, region_legacy_id)
COUNTIES = (
    (1, "Howlwadaag", "HWD", "- Howl-wadaag", 1),
    (6, "Hodan", "HD", "HD", 1),
    (7, "Waaberi", "WB", "WB", 1),
    (8, "Wartanabadda", "WN", "WN", 1),
    (9, "Xamarjajab", "XJ", "XJ", 1),
    (10, "Cabdicasiis", "CC", "CC", 1),
    (11, "Shangaani", "SG", "Sh", 1),
    (13, "Boondheere", "BD", "BD", 1),
    (16, "Dharkanleey", "DK", "DK", 1),
    (17, "Wadajir", "WD", "WJ", 1),
    (18, "Kaaraan", "K", "KR", 1),
    (19, "Heliwaa", "HL", "HL", 1),
    (20, "Yaaqshiid", "YS", "YS", 1),
    (23, "Dayniile", "DN", "DN", 1),
    (24, "Shibis", "SB", "SI", 1),
    (128, "Xamar Weyne", "252", "aSD", 1),
    (133, "Kaxda", "215", "", 1),
    (135, "Garasbaaley", "GB", "Degmada Garasbaaley", 1),
    (136, "Daaruu Salaam", "0", "ok", 1),
    (137, "Gubadley", "0", "ok", 1),
    (138, "Gubta", "00000", "0000", 1),
)
