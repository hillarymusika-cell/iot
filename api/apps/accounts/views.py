from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .serializers import LoginSerializer, SignupSerializer, UserSerializer

User = get_user_model()


def issue_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSerializer(user).data,
    }


def set_refresh_cookie(response, refresh_token: str):
    response.set_cookie(
        key=settings.JWT_AUTH_COOKIE,
        value=refresh_token,
        httponly=settings.JWT_AUTH_HTTPONLY,
        secure=settings.JWT_AUTH_SECURE,
        samesite=settings.JWT_AUTH_SAMESITE,
        max_age=7 * 24 * 3600,
        path="/api/auth/",
    )


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CSRFView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        payload = issue_tokens(user)
        response = Response(payload, status=status.HTTP_201_CREATED)
        set_refresh_cookie(response, payload["refresh"])
        return response


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()
        password = serializer.validated_data["password"]
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return Response({"detail": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED)
        user = authenticate(username=user.username, password=password)
        if user is None:
            return Response({"detail": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED)
        payload = issue_tokens(user)
        response = Response(payload)
        set_refresh_cookie(response, payload["refresh"])
        return response


class RefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw = request.COOKIES.get(settings.JWT_AUTH_COOKIE) or request.data.get("refresh")
        if not raw:
            return Response({"detail": "No refresh token."}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            refresh = RefreshToken(raw)
            access = str(refresh.access_token)
            user_id = refresh.get("user_id")
            user = User.objects.filter(id=user_id).first()
            data = {"access": access}
            if user:
                data["user"] = UserSerializer(user).data
            response = Response(data)
            set_refresh_cookie(response, str(refresh))
            return response
        except TokenError:
            return Response({"detail": "Invalid or expired refresh token."}, status=status.HTTP_401_UNAUTHORIZED)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        raw = request.COOKIES.get(settings.JWT_AUTH_COOKIE) or request.data.get("refresh")
        response = Response({"detail": "Logged out."})
        if raw:
            try:
                token = RefreshToken(raw)
                token.blacklist()
            except TokenError:
                pass
        response.delete_cookie(settings.JWT_AUTH_COOKIE, path="/api/auth/")
        return response
