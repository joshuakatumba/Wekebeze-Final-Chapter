from django.contrib import admin
from .models import AwarenessArticle, AwarenessCategory, GuidedChatNode, GuidedChatProgress

admin.site.register(AwarenessCategory)
admin.site.register(AwarenessArticle)
admin.site.register(GuidedChatNode)
admin.site.register(GuidedChatProgress)

