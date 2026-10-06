from django.contrib import admin

from .models import (
    CommentReply,
    Damiinada,
    FCMToken,
    Notice,
    ResponseComment,
    Suspect,
    SuspectArrest,
    SuspectCase,
    SuspectComment,
    SuspectResponse,
    SuspectStatus,
)


@admin.register(SuspectStatus)
class SuspectStatusAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Suspect)
class SuspectAdmin(admin.ModelAdmin):
    list_display = ("name", "case_ref", "district", "status", "suspect_type", "risk", "last_seen")
    list_filter = ("status", "risk", "district", "suspect_type")
    search_fields = ("name", "alias", "case_ref", "district")


@admin.register(SuspectCase)
class SuspectCaseAdmin(admin.ModelAdmin):
    list_display = ("case_code", "suspect", "damiin", "tuhunka", "capture_county", "created_at")
    list_filter = ("tuhunka",)
    search_fields = ("case_code", "suspect__name", "damiin__name")


@admin.register(Damiinada)
class DamiinadaAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "phone", "relationship", "new_relationship", "county", "sub_county")
    search_fields = ("code", "name", "phone")


@admin.register(SuspectArrest)
class SuspectArrestAdmin(admin.ModelAdmin):
    list_display = ("officer_name", "suspect", "arrested_at", "unit")


@admin.register(SuspectComment)
class SuspectCommentAdmin(admin.ModelAdmin):
    list_display = ("author_name", "suspect", "created_at")


@admin.register(SuspectResponse)
class SuspectResponseAdmin(admin.ModelAdmin):
    list_display = ("id", "suspect", "user", "date_opp", "created_at")
    list_filter = ("date_opp",)
    search_fields = ("suspect__name", "details")


@admin.register(ResponseComment)
class ResponseCommentAdmin(admin.ModelAdmin):
    list_display = ("id", "response", "user", "date_opp", "created_at")


@admin.register(CommentReply)
class CommentReplyAdmin(admin.ModelAdmin):
    list_display = ("id", "comment", "user", "date_opp", "created_at")


@admin.register(FCMToken)
class FCMTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "app_slug", "fcm_token", "created_at")
    list_filter = ("app_slug",)
    search_fields = ("fcm_token", "user__email")


@admin.register(Notice)
class NoticeAdmin(admin.ModelAdmin):
    list_display = ("tobic", "user", "is_new", "date_opp", "created_at")
    list_filter = ("is_new",)
