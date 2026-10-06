from django.contrib import admin

from .models import (
    DisarmamentImage,
    DisarmamentRecord,
    ForceUnit,
    Rank,
    SurrenderLocation,
    WeaponType,
)

admin.site.register(Rank)
admin.site.register(ForceUnit)
admin.site.register(WeaponType)
admin.site.register(SurrenderLocation)


@admin.register(DisarmamentRecord)
class DisarmamentRecordAdmin(admin.ModelAdmin):
    list_display = ("reference_number", "person_name", "weapon_type", "county", "surrender_date", "created_at")
    search_fields = ("reference_number", "person_name", "weapon_serial")
    list_filter = ("weapon_type", "county", "force_unit")


@admin.register(DisarmamentImage)
class DisarmamentImageAdmin(admin.ModelAdmin):
    list_display = ("record", "caption", "weapon_type", "created_at")
    raw_id_fields = ("record",)
