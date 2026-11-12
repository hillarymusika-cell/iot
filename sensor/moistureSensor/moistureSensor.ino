#include <WiFi.h>
#include <HTTPClient.h>
#include "credentials.h"
#include "pins.h"

const int moistureSensorPin = pins::moisturePin;
const int drySensorValue = 4095;
const int wetSensorValue = 0;
float moisturePercent = 0.0;

void ledResponse(int led, int times, int duration) {
  pinMode(led, OUTPUT);
  for (int count = 0; count < times; count++) {
    digitalWrite(led, HIGH);
    delay(duration);
    digitalWrite(led, LOW);
    delay(duration);
  }
}

void readSensorData() {
  const int sensorValue = analogRead(moistureSensorPin);
  moisturePercent = constrain(
      map(sensorValue, drySensorValue, wetSensorValue, 0, 100), 0, 100);

  Serial.print("Moisture sensor value: ");
  Serial.print(sensorValue);
  Serial.print(" | Moisture: ");
  Serial.print(moisturePercent, 1);
  Serial.println("%");
}

bool connectWifi(const char *wifi, const char *password) {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.println("Connecting to wifi ....");
  WiFi.begin(wifi, password);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 10) {
    ledResponse(pins::badLed, 1, 200);
    attempts++;
    delay(500);
  }

  if (WiFi.status() == WL_CONNECTED) {
    ledResponse(pins::goodLed, 2, 200);
    Serial.println("Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("Wi-Fi connection failed. Check the SSID and password.");
  return false;
}

void sendSensorData() {
  readSensorData();

  if (connectWifi(credential::wifi, credentials::wifiPassword)) {
    HTTPClient http;
    if (!http.begin(credentials::server_url)) {
      Serial.println("Unable to initialize the HTTP request.");
      return;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-ID", credentials::device_id);
    String authorization = "Bearer ";
    authorization += credentials::device_token;
    http.addHeader("Authorization", authorization);

    String payload = "{\"moisture\":" + String(moisturePercent, 1) + "}";
    const int response = http.POST(payload);
    Serial.println(response);
    Serial.println(http.getString());
    http.end();
  } else {
    Serial.println("Sensor data was not sent because Wi-Fi is unavailable.");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(moistureSensorPin, INPUT);
  analogReadResolution(12);
}

void loop() {
  sendSensorData();
  delay(60000);
}
