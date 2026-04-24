// 测试3: 从两个手摇发电机读真实电压 → 通过分压器进 A0/A1
// 协议: 每 50ms 发一行 "v1,v2\n" (两个 0~1000 之间的归一化值)
//
// 硬件回顾:
//   电机1(+) --[22kΩ]--●-- A0     中点 ● 接 A0
//                      │
//                     [3.3kΩ]
//                      │
//                     GND
//   (电机2 同理,走 A1)
//
// ═══════════════════════════════════════════════════════════
// 算法 4 步:
//   1. analogRead() → 0-4095 原始 ADC 值 (ESP32 是 12-bit)
//   2. 指数滑动平均 (EMA) 去噪
//   3. 死区裁切 (低于某值当 0,防止空载抖动让小人慢慢飘)
//   4. 线性映射到 0-1000 发串口
// ═══════════════════════════════════════════════════════════

// ─── 参数已按"电机5V-24V + 22k/3.3k分压 + ESP32 12-bit ADC"标定好 ───
const int SAMPLE_MS = 50;     // 采样周期 50ms = 20Hz (游戏够流畅)
const int DEADZONE  = 60;     // 低于此 ADC 值算 0 (避开噪声 + 小残压)
                              //   = 电机约 0.37V 以下 = 手没动
const int MAX_ADC   = 2000;   // 满速门槛 ≈ 电机 12.4V ≈ 使劲摇
                              //   低于此按比例给速度,达到就 100%
const int SMOOTH_N  = 6;      // EMA 窗口 (响应 ~0.3s,够快但不抖)

// 调试开关: 打开后每次会多发一行 "#raw:xxx,xxx" 让你在串口监视器里看原始 ADC
// p5.js 端会忽略 # 开头的行 (需要先在 serial.js 加过滤,目前不加也没事,parseFloat 会返回 NaN)
const bool DEBUG = false;

// EMA 累加器 (全局,跨循环保留)
float ema1 = 0;
float ema2 = 0;

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  analogReadResolution(12);     // Nano ESP32 默认就是 12-bit,这里显式写清楚
}

void loop() {
  // ---- 1. 原始采样 ----
  // 注意: ESP32 多通道共用一个 ADC,切换通道时会有电荷残留串扰。
  //       每个通道先空读一次 "清零",再真正读,彻底消除串扰。
  (void)analogRead(A0);         // 空读: 把 ADC 内部切到 A0 并稳定下来
  delayMicroseconds(50);
  int raw1 = analogRead(A0);    // 真读

  (void)analogRead(A1);         // 空读
  delayMicroseconds(50);
  int raw2 = analogRead(A1);    // 真读

  // ---- 2. 指数滑动平均 (EMA) ----
  // 公式: ema = ema + (raw - ema) / N
  // 等价于 "新值占 1/N 权重,旧值占 (N-1)/N 权重",比简单平均省内存
  ema1 += (raw1 - ema1) / SMOOTH_N;
  ema2 += (raw2 - ema2) / SMOOTH_N;

  // ---- 3 + 4. 死区 + 线性映射到 0-1000 ----
  int out1 = normalize(ema1);
  int out2 = normalize(ema2);

  // ---- 调试输出 (可选) ----
  if (DEBUG) {
    Serial.print("#raw:");
    Serial.print(raw1);
    Serial.print(",");
    Serial.println(raw2);
  }

  // ---- 正式输出: p5.js 接收 ----
  Serial.print(out1);
  Serial.print(",");
  Serial.println(out2);

  // ---- LED 指示: 只要有一路在摇就亮 ----
  digitalWrite(LED_BUILTIN, (out1 + out2) > 100 ? HIGH : LOW);

  delay(SAMPLE_MS);
}

// 把平滑后的 ADC 值映射到 0-1000
// - 低于 DEADZONE → 0 (剔除噪声)
// - 达到 MAX_ADC  → 1000 (游戏满速)
// - 之间线性映射
int normalize(float adc) {
  float v = adc - DEADZONE;
  if (v <= 0) return 0;

  float span = MAX_ADC - DEADZONE;
  int out = (int)(v / span * 1000.0);

  if (out > 1000) return 1000;
  return out;
}
