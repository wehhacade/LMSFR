from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.surveys.views import (
    AnalyticsViewSet,
    ChoiceViewSet,
    QuestionViewSet,
    RespondentViewSet,
    ResponseViewSet,
    SurveySectionViewSet,
    SurveyViewSet,
)
from apps.surveys.views.notifications import get_expired_deadlines, surveys_save_fcm_token

router = DefaultRouter()
router.register("surveys", SurveyViewSet, basename="survey")
router.register("responses", ResponseViewSet, basename="survey-response")
router.register("respondents", RespondentViewSet, basename="survey-respondent")
router.register("analytics", AnalyticsViewSet, basename="survey-analytics")
router.register("sections", SurveySectionViewSet, basename="survey-section")
router.register("questions", QuestionViewSet, basename="survey-question")
router.register("choices", ChoiceViewSet, basename="survey-choice")

urlpatterns = [
    path("fcm-token/", surveys_save_fcm_token, name="survey-save-fcm-token"),
    path("expired-deadlines/", get_expired_deadlines, name="survey-expired-deadlines"),
    path("", include(router.urls)),
]
