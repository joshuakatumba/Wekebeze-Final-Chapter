from datetime import timedelta
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class EmailOrPhoneBackend(ModelBackend):
    """Authenticate by email (case-insensitive) or phone number."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        User = get_user_model()
        identifier = (username or kwargs.get("email") or kwargs.get("phone") or "").strip()
        if not identifier or not password:
            return None
        user = User.objects.filter(email__iexact=identifier).first()
        if not user:
            user = User.objects.filter(phone=identifier).first()
        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None


class ExpiringTokenAuthentication(TokenAuthentication):
    """DRF TokenAuthentication with configurable SESSION_TOKEN_LIFETIME."""

    def authenticate_credentials(self, key):
        model = self.get_model()
        lifetime = getattr(settings, "SESSION_TOKEN_LIFETIME", timedelta(days=7))
        try:
            token = model.objects.select_related("user").get(key=key)
        except model.DoesNotExist:
            raise AuthenticationFailed({"detail": "Invalid token.", "code": "token_invalid"})

        if not token.user.is_active:
            raise AuthenticationFailed({"detail": "Account disabled.", "code": "user_inactive"})
        if lifetime and timezone.now() > (token.created + lifetime):
            raise AuthenticationFailed({"detail": "Token expired.", "code": "token_expired"})
        return (token.user, token)

