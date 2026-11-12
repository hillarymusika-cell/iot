from django.urls import path

from .views import CSRFView, LoginView, LogoutView, RefreshView, SignupView

urlpatterns = [
    path("api/csrf/", CSRFView.as_view(), name="csrf"),
    path("api/signup/", SignupView.as_view(), name="signup"),
    path("api/login/", LoginView.as_view(), name="login"),
    path("api/refresh/", RefreshView.as_view(), name="refresh"),
    path("api/logout/", LogoutView.as_view(), name="logout"),
]
