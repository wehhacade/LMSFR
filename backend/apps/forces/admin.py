from django.contrib import admin

from .models import Force


@admin.register(Force)
class ForceAdmin(admin.ModelAdmin):
    list_display  = ("badge_number", "name", "rank", "unit", "district", "status")
    list_filter   = ("status", "rank", "district")
    search_fields = ("name", "badge_number", "unit")
    ordering      = ("name",)
