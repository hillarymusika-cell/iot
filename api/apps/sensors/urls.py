from django.urls import path

from .views import AnalyticsSummaryView, ReadingListIngestView

urlpatterns = [
    path("api/sensors/readings/", ReadingListIngestView.as_view()),
    path("api/sensors/analytics/", AnalyticsSummaryView.as_view()),
]
