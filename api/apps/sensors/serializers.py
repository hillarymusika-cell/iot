from rest_framework import serializers

from .models import SensorReading


class ReadingIngestSerializer(serializers.Serializer):
    moisture = serializers.FloatField(min_value=0, max_value=100)
    temperature = serializers.FloatField(required=False, allow_null=True)
    humidity = serializers.FloatField(required=False, allow_null=True)


class SensorReadingSerializer(serializers.ModelSerializer):
    moisturereading = serializers.FloatField(source="moisture")
    updatetime = serializers.DateTimeField(source="recorded_at")

    class Meta:
        model = SensorReading
        fields = ("id", "moisturereading", "updatetime", "temperature", "humidity", "device_id")
