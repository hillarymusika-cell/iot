from rest_framework import authentication, exceptions

from apps.devices.models import Device


class DeviceTokenAuthentication(authentication.BaseAuthentication):
    """
    Authenticate IoT devices via:
      Authorization: Bearer <device_token>
      X-Device-ID: <uuid>
    """

    keyword = "Bearer"

    def authenticate(self, request):
        auth_header = request.headers.get("Authorization", "")
        device_id = request.headers.get("X-Device-ID")
        if not auth_header.startswith(f"{self.keyword} ") or not device_id:
            return None
        token = auth_header[len(self.keyword) + 1 :].strip()
        try:
            device = Device.objects.select_related("owner").get(
                id=device_id, token=token, is_active=True
            )
        except (Device.DoesNotExist, ValueError):
            raise exceptions.AuthenticationFailed("Invalid device credentials.")
        return (device.owner, device)
