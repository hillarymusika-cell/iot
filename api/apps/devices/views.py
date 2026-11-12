from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Device
from .serializers import DeviceCreateSerializer, DeviceSerializer


class DeviceListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        devices = Device.objects.filter(owner=request.user)
        return Response(DeviceSerializer(devices, many=True).data)

    def post(self, request):
        serializer = DeviceCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        device = serializer.save()
        return Response(
            {
                "device_id": str(device.id),
                "token": device.token,
                "name": device.name,
            },
            status=status.HTTP_201_CREATED,
        )
