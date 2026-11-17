/**
 * Moisture node → Django sensors API (master)
 *
 * Contract (api/apps/sensors):
 *   POST /api/sensors/readings/
 *   Headers:
 *     Content-Type: application/json
 *     Authorization: Bearer <device_token>
 *     X-Device-ID: <device uuid>
 *   Body: {"moisture": <0-100 float>}   // optional: temperature, humidity
 *   Success: HTTP 201
 *
 * Auth: DeviceTokenAuthentication (api/apps/sensors/authentication.py)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include "credentials.h"
#include "pins.h"

const int moistureSensorPin = pins::moisturePin[0];
const int drySensorValue = 4095;  // 12-bit ADC dry
const int wetSensorValue = 0;     // 12-bit ADC wet
float moisturePercent = 0.0f;

void ledResponse(int led, int times, int durationMs) {
  pinMode(led, OUTPUT);
  for (int count = 0; count < times; count++) {
    digitalWrite(led, HIGH);
    delay(durationMs);
    digitalWrite(led, LOW);
    delay(durationMs);
  }
}

void readSensorData() {
  const int sensorValue = analogRead(moistureSensorPin);
  moisturePercent = constrain(
      map(sensorValue, drySensorValue, wetSensorValue, 0, 100), 0, 100);

  Serial.print(F("Moisture raw="));
  Serial.print(sensorValue);
  Serial.print(F(" percent="));
  Serial.print(moisturePercent, 1);
  Serial.println('%');
}

bool connectWifi(const char *ssid, const char *password) {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.println(F("Connecting to Wi-Fi..."));
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    ledResponse(pins::badLed[0], 1, 150);
    attempts++;
    delay(500);
  }

  if (WiFi.status() == WL_CONNECTED) {
    ledResponse(pins::goodLed[0], 2, 150);
    Serial.print(F("Wi-Fi OK IP="));
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println(F("Wi-Fi failed — check SSID/password"));
  return false;
}

// Build body matching ReadingIngestSerializer: moisture required; temp/humidity optional
String buildPayload(float moisture) {
  String payload = "{\"moisture\":";
  payload += String(moisture, 1);
  payload += "}";
  return payload;
}

void sendSensorData() {
  readSensorData();

  if (!connectWifi(credentials::wifi, credentials::wifiPassword)) {
    Serial.println(F("Skip POST: no Wi-Fi"));
    return;
  }

  HTTPClient http;
  if (!http.begin(credentials::server_url)) {
    Serial.println(F("HTTP begin failed — check server_url"));
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-ID", credentials::device_id);

  String authorization = "Bearer ";
  authorization += credentials::device_token;
  http.addHeader("Authorization", authorization);

  const String payload = buildPayload(moisturePercent);
  Serial.print(F("POST "));
  Serial.print(credentials::server_url);
  Serial.print(F(" body="));
  Serial.println(payload);

  const int statusCode = http.POST(payload);
  const String responseBody = http.getString();
  http.end();

  // api/apps/sensors/views.py ReadingListIngestView.post → 201 Created
  if (statusCode == 201) {
    ledResponse(pins::goodLed[0], 1, 80);
    Serial.print(F("Ingest OK 201: "));
    Serial.println(responseBody);
  } else if (statusCode == 401) {
    ledResponse(pins::badLed[0], 3, 100);
    Serial.print(F("Auth failed 401 — check device_id / device_token: "));
    Serial.println(responseBody);
  } else if (statusCode == 400) {
    ledResponse(pins::badLed[0], 2, 100);
    Serial.print(F("Validation error 400: "));
    Serial.println(responseBody);
  } else {
    ledResponse(pins::badLed[0], 4, 80);
    Serial.print(F("POST failed HTTP "));
    Serial.print(statusCode);
    Serial.print(F(": "));
    Serial.println(responseBody);
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  pinMode(moistureSensorPin, INPUT);
  analogReadResolution(12);
  Serial.println(F("Moisture sensor → /api/sensors/readings/"));
}

void loop() {
  sendSensorData();
  delay(10000);  // 10s interval
}
