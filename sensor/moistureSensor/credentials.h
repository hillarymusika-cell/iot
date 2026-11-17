#ifndef CREDENTIALS_H
#define CREDENTIALS_H

// Copy from credentials.example.h and fill after POST /api/devices/
// (returns device_id + token). Do not commit real secrets.
namespace credentials {
  // Wi-Fi station the ESP32 joins
  const char wifi[] = "YOUR_WIFI_SSID";
  const char wifiPassword[] = "YOUR_WIFI_PASSWORD";

  // Must match api/apps/sensors/urls.py → path("api/sensors/readings/", ...)
  // Local Docker/API:  http://<host-lan-ip>:8000/api/sensors/readings/
  // Deployed example:  https://your-api-host/api/sensors/readings/
  // Note: localhost is unreachable from the ESP32 itself.
  const char server_url[] = "http://192.168.1.10:8000/api/sensors/readings/";

  // From device registration response: {"device_id": "...", "token": "..."}
  const char device_id[] = "00000000-0000-0000-0000-000000000000";
  const char device_token[] = "REPLACE_WITH_DEVICE_TOKEN";
}

#endif
