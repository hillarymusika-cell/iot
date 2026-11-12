from django.urls import path

from .views import DeviceListCreateView

urlpatterns = [
    path("", DeviceListCreateView.as_view(), name="device-list-create"),
]
