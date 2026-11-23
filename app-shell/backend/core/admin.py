from django.contrib import admin
from .models import AppConfig, AuditLog, Notification, UploadedFile

admin.site.register(AppConfig)
admin.site.register(UploadedFile)
admin.site.register(Notification)
admin.site.register(AuditLog)

