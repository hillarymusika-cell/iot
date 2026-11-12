from django.db.models import Avg, Count, Max, Min
from django.utils import timezone
from datetime import timedelta

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import DeviceTokenAuthentication
from .models import SensorReading
from .serializers import ReadingIngestSerializer, SensorReadingSerializer


class ReadingListIngestView(APIView):
    """
    GET  /api/sensors/readings/  — public dashboard feed (matches frontend).
    POST /api/sensors/readings/  — called by ESP32 devices with device token.
    """

    def get_authenticators(self):
        if self.request.method == "POST":
            return [DeviceTokenAuthentication()]
        return []

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get(self, request):
        qs = SensorReading.objects.select_related("device").order_by("recorded_at")
        device_id = request.query_params.get("device_id")
        if device_id:
            qs = qs.filter(device_id=device_id)
        qs = list(qs[:500])
        data = SensorReadingSerializer(qs, many=True).data
        return Response(data)

    def post(self, request):
        device = request.auth
        if device is None:
            return Response(
                {"detail": "Device authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        serializer = ReadingIngestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reading = SensorReading.objects.create(
            device=device,
            moisture=serializer.validated_data["moisture"],
            temperature=serializer.validated_data.get("temperature"),
            humidity=serializer.validated_data.get("humidity"),
        )
        return Response(
            {
                "id": reading.id,
                "moisture": reading.moisture,
                "recorded_at": reading.recorded_at,
            },
            status=status.HTTP_201_CREATED,
        )


class AnalyticsSummaryView(APIView):
    """GET /api/sensors/analytics/  — aggregated stats for the dashboard."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        hours = int(request.query_params.get("hours", 24))
        since = timezone.now() - timedelta(hours=hours)
        qs = SensorReading.objects.filter(recorded_at__gte=since)

        device_id = request.query_params.get("device_id")
        if device_id:
            qs = qs.filter(device_id=device_id)

        agg = qs.aggregate(
            count=Count("id"),
            avg_moisture=Avg("moisture"),
            min_moisture=Min("moisture"),
            max_moisture=Max("moisture"),
            avg_temperature=Avg("temperature"),
            avg_humidity=Avg("humidity"),
        )

        latest = qs.order_by("-recorded_at").first()
        return Response(
            {
                "window_hours": hours,
                "sample_count": agg["count"] or 0,
                "moisture": {
                    "avg": round(agg["avg_moisture"], 2) if agg["avg_moisture"] is not None else None,
                    "min": agg["min_moisture"],
                    "max": agg["max_moisture"],
                },
                "temperature_avg": round(agg["avg_temperature"], 2) if agg["avg_temperature"] is not None else None,
                "humidity_avg": round(agg["avg_humidity"], 2) if agg["avg_humidity"] is not None else None,
                "latest": SensorReadingSerializer(latest).data if latest else None,
            }
        )
