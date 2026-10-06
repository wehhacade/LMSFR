from django.contrib import admin

from apps.baaris.models import BaarisCitizenProfile


@admin.register(BaarisCitizenProfile)
class BaarisCitizenProfileAdmin(admin.ModelAdmin):
    list_display = ("id", "suspect", "hormuud", "qabiilka", "created_at")
    search_fields = ("suspect__name", "hormuud", "nira", "form_number")
    raw_id_fields = ("suspect", "created_by")
