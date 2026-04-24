// 测试2: 通过串口发送两路假数据 (模拟两个手摇发电机)
// 目的: 在硬件到货前调通 p5.js 的双人串口逻辑
// 输出: 每 100ms 发一行 "val1,val2" (两个 0~1000 之间的数)
//       两个值用不同周期和相位的正弦波,互相错开,便于肉眼看清
// 真硬件到货后: 把 fake1/fake2 换成 analogRead(A0) / analogRead(A1) 即可

const int SAMPLE_MS = 100;   // 10Hz 采样率 (游戏才会流畅)

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  int v1 = fakeValue(8000.0, 0.0);           // 周期 8 秒
  int v2 = fakeValue(12000.0, HALF_PI);      // 周期 12 秒, 错开相位

  Serial.print(v1);
  Serial.print(',');
  Serial.println(v2);

  // LED 亮度反映 v1,方便肉眼看板子"在输出"
  digitalWrite(LED_BUILTIN, v1 > 500 ? HIGH : LOW);

  delay(SAMPLE_MS);
}

int fakeValue(float periodMs, float phase) {
  unsigned long t = millis();
  float x = (t / periodMs) * TWO_PI + phase;
  return (int)(500 + 500 * sin(x));
}
