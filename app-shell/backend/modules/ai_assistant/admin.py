from django.contrib import admin
from .models import Conversation, KnowledgeChunk, KnowledgeDocument, Message

admin.site.register(KnowledgeDocument)
admin.site.register(KnowledgeChunk)
admin.site.register(Conversation)
admin.site.register(Message)

