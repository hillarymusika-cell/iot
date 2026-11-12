from django.urls import path

from .views import AnalyticsSummaryView, ReadingListIngestView

urlpatterns = [
    path("api/readings/", ReadingListIngestView.as_view(), name="readings"),
    path("api/analytics/", AnalyticsSummaryView.as_view(), name="analytics-summary"),
]
