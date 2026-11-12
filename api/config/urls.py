from django.contrib import admin
from django.http import JsonResponse
from django.shortcuts import render
from django.urls import include, path, reverse


def health(_request):
    return JsonResponse({"status": "ok"})


def home(request):
    return render(
        request,
        "home.html",
        {
            "api_url": reverse("api-root"),
            "health_url": reverse("health"),
            "readings_url": reverse("readings"),
            "analytics_url": reverse("analytics-summary"),
            "devices_url": reverse("device-list-create"),
        },
    )


def api_root(request):
    auth_endpoints = {
        "csrf": "csrf",
        "signup": "signup",
        "login": "login",
        "refresh": "refresh",
        "logout": "logout",
    }
    endpoints = {
        "devices": "device-list-create",
        "readings": "readings",
        "analytics": "analytics-summary",
    }
    return JsonResponse(
        {
            "auth": {
                action: request.build_absolute_uri(reverse(route_name))
                for action, route_name in auth_endpoints.items()
            },
            **{
                name: request.build_absolute_uri(reverse(route_name))
                for name, route_name in endpoints.items()
            },
        }
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", home, name="home"),
    path("health/", health, name="health"),
    path("api/", api_root, name="api-root"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/devices/", include("apps.devices.urls")),
    path("api/sensors/", include("apps.sensors.urls")),
]
