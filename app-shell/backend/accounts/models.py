from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email=None, phone=None, password=None, role="user", **extra):
        if not email and not phone:
            raise ValueError("Either email or phone is required.")
        email = self.normalize_email(email) if email else ""
        phone = phone or None
        user = self.model(email=email, phone=phone, role=role, **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("is_verified", True)
        return self.create_user(email=email, password=password, role="admin", **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """Generic reusable User model with JSON metadata for app-specific attributes."""

    class Role(models.TextChoices):
        USER = "user", "User"
        PROVIDER = "provider", "Operator"
        ADMIN = "admin", "Administrator"

    email = models.EmailField(unique=True, db_index=True)
    phone = models.CharField(max_length=24, unique=True, null=True, blank=True)
    name = models.CharField(max_length=200)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.USER)
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    metadata = models.JSONField(default=dict, blank=True)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        db_table = "shell_users"
        ordering = ["-date_joined"]

    def save(self, *args, **kwargs):
        if self.phone == "":
            self.phone = None
        super().save(*args, **kwargs)

    @property
    def is_platform_admin(self):
        return self.is_staff or self.is_superuser or self.role == self.Role.ADMIN

    def __str__(self):
        return f"{self.name} ({self.role})"

