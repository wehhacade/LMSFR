"""Citizen identification profile — OneToOne extension of Suspect (source=baaris)."""

from django.conf import settings
from django.db import models


class BaarisCitizenProfile(models.Model):
    """Extra fields for Foomka Aqoonsiga iyo Xog-Ururinta Muwaadinka."""

    suspect = models.OneToOneField(
        "suspects.Suspect",
        on_delete=models.CASCADE,
        related_name="baaris_profile",
    )

    # 3. Degganaansho
    waaxda = models.CharField(max_length=120, blank=True)
    xaafadda = models.CharField(max_length=120, blank=True)
    ijaar_ama_milkiyad = models.CharField(max_length=80, blank=True)
    mudada_uu_deggan_yahay = models.CharField(max_length=120, blank=True)
    yaa_ka_ijaaray = models.CharField(max_length=200, blank=True)
    deegaannadiisa_hore = models.TextField(blank=True)

    # 4. Xiriir (operator phones — primary also on Suspect.phone)
    hormuud = models.CharField(max_length=20, blank=True, db_index=True)
    somnet = models.CharField(max_length=20, blank=True)
    somtel = models.CharField(max_length=20, blank=True)

    # 5. Shaqo
    nuuca_shaqada = models.CharField(max_length=120, blank=True)
    goobta_shaqada = models.CharField(max_length=200, blank=True)
    maamulaha_shaqada = models.CharField(max_length=200, blank=True)
    muddada_shaqada = models.CharField(max_length=120, blank=True)
    shaqooyin_hore = models.TextField(blank=True)

    # 6. Qoys
    xaaladda_guurka = models.CharField(max_length=100, blank=True)
    tirada_carruurta = models.PositiveSmallIntegerField(default=0)
    tirada_dadka_guriga = models.PositiveSmallIntegerField(default=0)
    qof_degdeg = models.CharField(max_length=200, blank=True)
    xaasas_hore = models.TextField(blank=True)

    # 7. Aqoonsi dheeraad / background
    qabiilka = models.CharField(max_length=120, blank=True)
    gobolka_kasoo_jeedo = models.CharField(max_length=120, blank=True)
    nabadoonkiisa = models.CharField(max_length=200, blank=True)
    xubnaha_qoyska_dowlad = models.TextField(blank=True)
    dhaawaco_rasaas = models.TextField(blank=True)
    calaamado_aqoonsi = models.TextField(blank=True)
    horay_maloo_xiray = models.CharField(max_length=80, blank=True)

    # 8. Gaadiid
    gaadiid_nooca = models.CharField(max_length=120, blank=True)
    gaadiid_taargada = models.CharField(max_length=80, blank=True)
    gaadiid_lisence = models.CharField(max_length=80, blank=True)
    gaadiid_milkiyad_mise_ijaar = models.CharField(max_length=80, blank=True)

    # 9. Dukumentiyo
    nira = models.CharField(max_length=120, blank=True)
    baasaboor = models.CharField(max_length=120, blank=True)
    license_doc = models.CharField(max_length=120, blank=True)

    # 10–11. Notes + officer verification
    qoraallo_dheeraad = models.TextField(blank=True)
    form_number = models.CharField(max_length=64, blank=True, db_index=True)
    sarkaalka_magaca = models.CharField(max_length=200, blank=True)
    goobta_xaqiijinta = models.CharField(max_length=200, blank=True)
    taariikhda_xaqiijinta = models.DateField(null=True, blank=True)

    age_reported = models.PositiveSmallIntegerField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="baaris_profiles_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "baaris_citizen_profiles"
        ordering = ["-updated_at"]
        verbose_name = "Baaris citizen profile"
        verbose_name_plural = "Baaris citizen profiles"
        permissions = [
            ("view_baaris_module", "Can view Baaris dashboard module"),
        ]

    def __str__(self) -> str:
        return f"Baaris:{self.suspect_id}"
