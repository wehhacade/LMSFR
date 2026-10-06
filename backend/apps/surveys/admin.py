from django.contrib import admin

from .models import Answer, Choice, Question, Response, Survey, SurveySection


class SurveySectionInline(admin.StackedInline):
    model = SurveySection
    extra = 0
    show_change_link = True


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 0


class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 0


@admin.register(Survey)
class SurveyAdmin(admin.ModelAdmin):
    list_display = ("name", "status", "created_by", "created_at", "updated_at")
    list_filter = ("status",)
    search_fields = ("name", "description")
    readonly_fields = ("created_at", "updated_at")
    inlines = [SurveySectionInline]


@admin.register(SurveySection)
class SurveySectionAdmin(admin.ModelAdmin):
    list_display = ("survey", "title", "order")
    list_filter = ("survey",)
    inlines = [QuestionInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("text", "section", "qtype", "required", "order")
    list_filter = ("qtype", "required")
    search_fields = ("text",)
    inlines = [ChoiceInline]


@admin.register(Response)
class ResponseAdmin(admin.ModelAdmin):
    list_display = ("survey", "user", "phone_number", "submitted_at")
    list_filter = ("survey",)
    search_fields = ("phone_number", "guri_number")
    readonly_fields = ("submitted_at",)


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ("response", "question")
    list_filter = ("question__qtype",)
    search_fields = ("response__phone_number",)
