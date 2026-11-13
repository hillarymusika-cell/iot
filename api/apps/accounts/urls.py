from django.urls import path

from .views import CSRFView, LoginView, LogoutView, RefreshView, SignupView

urlpatterns = [
    path("api/auth/csrf/", CSRFView.as_view(), name="csrf"),
    path("api/auth/signup/", SignupView.as_view(), name="signup"),
    path("api/auth/login/", LoginView.as_view(), name="login"),
    path("api/auth/refresh/", RefreshView.as_view(), name="refresh"),
    path("api/auth/logout/", LogoutView.as_view(), name="logout"),
]
