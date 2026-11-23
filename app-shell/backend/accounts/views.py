import json
import urllib.parse
import urllib.request
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from core.permissions import IsPlatformAdmin
from core.services import log_audit
from .models import User
from .serializers import RegisterSerializer, UserProfileSerializer


def _expires_at(token):
    lifetime = getattr(settings, "SESSION_TOKEN_LIFETIME", timedelta(days=7))
    return (token.created + lifetime).isoformat()


def _fresh_token(user):
    lifetime = getattr(settings, "SESSION_TOKEN_LIFETIME", timedelta(days=7))
    token = Token.objects.filter(user=user).first()
    if token and lifetime and timezone.now() > token.created + lifetime:
        token.delete()
        token = None
    return token or Token.objects.create(user=user)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        token = _fresh_token(user)
        log_audit(request, "user.registered", "User", user.id)
        return Response(
            {"token": token.key, "user": UserProfileSerializer(user).data, "expires_at": _expires_at(token)},
            status=status.HTTP_201_CREATED,
        )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def login_view(request):
    identifier = (request.data.get("email") or request.data.get("phone") or "").strip()
    password = request.data.get("password") or ""
    if not identifier or not password:
        return Response({"error": "Email/phone and password are required."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email__iexact=identifier).first() or User.objects.filter(phone=identifier).first()
    if not user or not user.check_password(password):
        return Response({"error": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)
    if not user.is_active:
        return Response({"error": "Account disabled."}, status=status.HTTP_403_FORBIDDEN)

    token = _fresh_token(user)
    log_audit(request, "user.login", "User", user.id, actor=user)
    return Response({"token": token.key, "user": UserProfileSerializer(user).data, "expires_at": _expires_at(token)})


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def google_auth_view(request):
    """Google OAuth Sign-In for standard user accounts."""
    credential = request.data.get("credential")
    if not credential:
        return Response({"error": "Google credential is required."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={urllib.parse.quote(str(credential))}"
        with urllib.request.urlopen(url, timeout=8) as resp:
            info = json.loads(resp.read().decode("utf-8"))
    except Exception:
        return Response({"error": "Invalid Google token."}, status=status.HTTP_401_UNAUTHORIZED)

    client_id = getattr(settings, "GOOGLE_CLIENT_ID", "")
    if client_id and info.get("aud") != client_id:
        return Response({"error": "Google token audience mismatch."}, status=status.HTTP_401_UNAUTHORIZED)

    email = (info.get("email") or "").strip().lower()
    if not email or str(info.get("email_verified", "")).lower() != "true":
        return Response({"error": "Verified Google email required."}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email__iexact=email).first()
    if user:
        if user.role != User.Role.USER:
            return Response({"error": "Google Sign-In is restricted to standard user accounts."}, status=status.HTTP_403_FORBIDDEN)
        if not user.is_active:
            return Response({"error": "Account disabled."}, status=status.HTTP_403_FORBIDDEN)
    else:
        user = User.objects.create_user(
            email=email,
            name=(info.get("name") or email.split("@")[0])[:200],
            role=User.Role.USER,
            is_verified=True,
        )

    token = _fresh_token(user)
    log_audit(request, "user.google_login", "User", user.id, actor=user)
    return Response({"token": token.key, "user": UserProfileSerializer(user).data, "expires_at": _expires_at(token)})


@api_view(["GET", "PATCH"])
@permission_classes([permissions.IsAuthenticated])
def me_view(request):
    if request.method == "GET":
        return Response(UserProfileSerializer(request.user).data)
    serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def refresh_token_view(request):
    Token.objects.filter(user=request.user).delete()
    token = Token.objects.create(user=request.user)
    return Response({"token": token.key, "expires_at": _expires_at(token)})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    Token.objects.filter(user=request.user).delete()
    return Response({"message": "Logged out."})


class AdminUserListView(generics.ListAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsPlatformAdmin]

    def get_queryset(self):
        qs = User.objects.all()
        q = self.request.query_params.get("q")
        role = self.request.query_params.get("role")
        if q:
            qs = qs.filter(name__icontains=q) | qs.filter(email__icontains=q)
        if role:
            qs = qs.filter(role=role)
        return qs


@api_view(["POST"])
@permission_classes([IsPlatformAdmin])
def toggle_user_active(request, pk):
    user = User.objects.filter(pk=pk).first()
    if not user:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
    if user.pk == request.user.pk or user.is_staff:
        return Response({"error": "Cannot suspend staff accounts."}, status=status.HTTP_400_BAD_REQUEST)
    user.is_active = not user.is_active
    user.save(update_fields=["is_active"])
    if not user.is_active:
        Token.objects.filter(user=user).delete()
    log_audit(request, "admin.toggle_active", "User", user.id, {"is_active": user.is_active})
    return Response(UserProfileSerializer(user).data)


@api_view(["POST"])
@permission_classes([IsPlatformAdmin])
def verify_user(request, pk):
    user = User.objects.filter(pk=pk).first()
    if not user:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
    user.is_verified = True
    user.save(update_fields=["is_verified"])
    log_audit(request, "admin.verify_user", "User", user.id)
    return Response(UserProfileSerializer(user).data)


@api_view(["PATCH"])
@permission_classes([IsPlatformAdmin])
def update_user_role(request, pk):
    user = User.objects.filter(pk=pk).first()
    if not user:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
    if user.pk == request.user.pk:
        return Response({"error": "Cannot change your own role."}, status=status.HTTP_400_BAD_REQUEST)
    role = request.data.get("role")
    valid_roles = {c[0] for c in User.Role.choices}
    if role not in valid_roles:
        return Response({"error": f"Invalid role. Must be one of: {', '.join(sorted(valid_roles))}"}, status=status.HTTP_400_BAD_REQUEST)
    user.role = role
    user.is_staff = role == User.Role.ADMIN
    user.save(update_fields=["role", "is_staff"])
    log_audit(request, "admin.update_role", "User", user.id, {"role": role})
    return Response(UserProfileSerializer(user).data)

