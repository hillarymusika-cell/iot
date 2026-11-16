from django.urls import path

from .views import AnalyticsSummaryView, ReadingListIngestView

urlpatterns = [
    path("api/sensors/readings/", ReadingListIngestView.as_view(), name="readings"),
    path("api/sensors/analytics/", AnalyticsSummaryView.as_view(), name="analytics"),
]
