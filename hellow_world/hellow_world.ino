void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
}

void loop() {
  digitalWrite(2,HIGH);
  Serial.println("ESP32 is running");
  delay(500);

  digitalWrite(2,LOW);
  delay(500);

}
