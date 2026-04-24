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

const int SAMPLE_MS = 50;     // 采样周期 (20Hz,游戏够流畅)
const int DEADZONE  = 80;     // 死区: ADC 低于此值算 0 (ESP32 噪声地板 ~30-50)
const int MAX_ADC   = 2500;   // 满速对应的 ADC 值 (~2500 ≈ 电机 15V,正常摇就能到)
const int SMOOTH_N  = 6;      // EMA 窗口,大=更平滑但有延迟 (4-10 之间)

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
  int raw1 = analogRead(A0);
  int raw2 = analogRead(A1);

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
