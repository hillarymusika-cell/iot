#ifndef CREDENTIALS_H
#define CREDENTIALS_H

// Template for sensor/moistureSensor/credentials.h
// 1. Register a device (authenticated POST /api/devices/ {"name": "..."})
// 2. Copy device_id + token into the fields below
// 3. Point server_url at a host the ESP32 can reach (LAN IP or public API)

namespace credentials {
  const char wifi[] = "YOUR_WIFI_SSID";
  const char wifiPassword[] = "YOUR_WIFI_PASSWORD";
  const char server_url[] = "http://192.168.1.10:8000/api/sensors/readings/";
  const char device_id[] = "00000000-0000-0000-0000-000000000000";
  const char device_token[] = "REPLACE_WITH_DEVICE_TOKEN";
}

#endif
