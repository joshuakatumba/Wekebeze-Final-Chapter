from .models import AuditLog, Notification


def get_client_ip(request):
    if not request:
        return ""
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def log_audit(request, action, target_type="", target_id="", metadata=None, actor=None):
    user = actor or (request.user if request and getattr(request, "user", None) and request.user.is_authenticated else None)
    return AuditLog.objects.create(
        actor=user,
        action=action,
        target_type=str(target_type),
        target_id=str(target_id),
        metadata=metadata or {},
        ip_address=get_client_ip(request),
    )


def notify(user, title, message="", channel="in_app"):
    return Notification.objects.create(user=user, title=title, message=message, channel=channel)

