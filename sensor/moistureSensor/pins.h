#ifndef PINS_H
#define PINS_H

namespace pins {
  // GPIO assignments for the moisture node (ESP32)
  const int badLed[] = {15};
  const int goodLed[] = {2};
  const int moisturePin[] = {34};  // ADC1 channel — valid while Wi-Fi is active
}

#endif
