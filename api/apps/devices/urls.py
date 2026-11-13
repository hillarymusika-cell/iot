from django.urls import path

from .views import DeviceListCreateView

urlpatterns = [
    path("api/devices", DeviceListCreateView.as_view()),
]
