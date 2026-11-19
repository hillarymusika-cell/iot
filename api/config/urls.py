from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.shortcuts import render
from django.urls import include, path, reverse




def health(_request):
    return JsonResponse({},status=200)


def home(request):
    return render(
        request,
        "index.html",
        {
            "dashboard_url": settings.FRONTEND_URL,
        },
    )


def api_root(_request):
    auth_endpoints = {
        "csrf": "csrf",
        "signup": "signup",
        "login": "login",
        "refresh": "refresh",
        "logout": "logout",
    }
    endpoints = {
        "devices": "devices",
        "readings": "readings",
        "analytics": "analytics",
    }
    return JsonResponse(
        {
            "auth": {
                action: reverse(route_name)
                for action, route_name in auth_endpoints.items()
            },
            **{
                name: reverse(route_name)
                for name, route_name in endpoints.items()
            },
        }
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", home, name="home"),
    path("health/", health, name="health"),
    path("api/health/", health),
    path("api/", api_root, name="api-root"),
    path("", include("apps.accounts.urls")),
    path("", include("apps.devices.urls")),
    path("", include("apps.sensors.urls")),
]
