from django.urls import path
from . import views

app_name = "accounts"

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.login_view, name="login"),
    path("google/", views.google_auth_view, name="google"),
    path("me/", views.me_view, name="me"),
    path("token/refresh/", views.refresh_token_view, name="token-refresh"),
    path("logout/", views.logout_view, name="logout"),
    path("users/", views.AdminUserListView.as_view(), name="admin-users"),
    path("users/<int:pk>/toggle-active/", views.toggle_user_active, name="toggle-active"),
    path("users/<int:pk>/verify/", views.verify_user, name="verify-user"),
]

