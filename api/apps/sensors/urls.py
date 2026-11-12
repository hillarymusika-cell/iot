from django.urls import path

from .views import AnalyticsSummaryView, ReadingListIngestView

urlpatterns = [
    path("readings/", ReadingListIngestView.as_view(), name="readings"),
    path("analytics/", AnalyticsSummaryView.as_view(), name="analytics-summary"),
]
