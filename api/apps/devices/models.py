import secrets
import uuid

from django.conf import settings
from django.db import models


def generate_device_token() -> str:
    return secrets.token_urlsafe(32)


class Device(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="devices",
    )
    name = models.CharField(max_length=120)
    token = models.CharField(max_length=64, unique=True, default=generate_device_token, editable=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.id})"
