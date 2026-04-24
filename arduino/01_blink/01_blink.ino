// 测试1: 板载 LED 闪烁
// 目的: 验证 Arduino IDE 能成功上传代码到 Nano ESP32
// 期望: 板子上的橙色 LED 每秒闪一下

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
