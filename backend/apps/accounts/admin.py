from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from apps.accounts.models import Agent, County, Department, Directorate, OTPCode, Region, Relationship, SubCounty, User, UserDevice, UserType


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ["email", "username", "phone", "is_active", "is_admin", "date_joined"]
    list_filter = ["is_active", "is_admin", "is_officer", "is_agent", "suspend"]
    search_fields = ["email", "username", "phone", "first_name", "last_name"]
    ordering = ["-date_joined"]
    fieldsets = UserAdmin.fieldsets + (
        (
            "LMSBR Profile",
            {
                "fields": (
                    "phone",
                    "gender",
                    "bio",
                    "profile",
                    "user_type",
                    "directorate",
                    "department",
                    "county",
                    "is_admin",
                    "is_officer",
                    "is_agent",
                    "suspend",
                ),
            },
        ),
    )


@admin.register(UserType)
class UserTypeAdmin(admin.ModelAdmin):
    list_display = ["name", "code"]


@admin.register(Directorate)
class DirectorateAdmin(admin.ModelAdmin):
    list_display = ["name", "created_at"]


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ["name", "created_at"]


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "id"]
    search_fields = ["name", "code"]


@admin.register(County)
class CountyAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "region", "id"]
    list_filter = ["region"]
    search_fields = ["name", "code"]


@admin.register(Relationship)
class RelationshipAdmin(admin.ModelAdmin):
    list_display = ["id", "relationship"]
    search_fields = ["relationship"]


@admin.register(SubCounty)
class SubCountyAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "county", "id"]
    list_filter = ["county"]
    search_fields = ["name", "code"]


@admin.register(Agent)
class AgentAdmin(admin.ModelAdmin):
    list_display = ["personal_fullname", "service_id", "phone", "status", "present"]
    search_fields = ["first_name", "last_name", "phone", "service_id"]


@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    list_display = ["user", "number"]


@admin.register(UserDevice)
class UserDeviceAdmin(admin.ModelAdmin):
    list_display = ["user", "device", "ip_address", "created_at"]
