from django.contrib import admin

from apps.visitors.models import Visit, VisitAllegation, VisitDestination, Visitor


class VisitInline(admin.TabularInline):
    model = Visit
    extra = 0
    raw_id_fields = ("created_by",)
    readonly_fields = ("created_at",)


@admin.register(Visitor)
class VisitorAdmin(admin.ModelAdmin):
    list_display = ("id", "full_name", "gender", "phone", "nira", "visited_at", "verified", "is_hidden", "created_by")
    list_filter = ("verified", "gender", "is_hidden")
    search_fields = ("full_name", "mother_name", "phone", "nira")
    raw_id_fields = ("created_by",)
    inlines = [VisitInline]


@admin.register(VisitDestination)
class VisitDestinationAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "sort_order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)
    ordering = ("sort_order", "id")


@admin.register(VisitAllegation)
class VisitAllegationAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "sort_order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)
    ordering = ("sort_order", "id")


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = ("id", "visitor", "visiting", "allegation", "contact_name", "relationship", "visited_at", "verified", "created_by")
    list_filter = ("verified",)
    search_fields = ("visiting", "allegation__name", "contact_name", "relationship", "visitor__full_name", "visitor__nira", "visitor__phone")
    raw_id_fields = ("visitor", "created_by")
