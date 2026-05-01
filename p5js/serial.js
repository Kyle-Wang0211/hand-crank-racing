// Web Serial API 封装 (EMI 抗扰版)
// 关键设计:
//   1. 读原始字节,自己解码 — 避免 TextDecoder 见到坏字节就抛错
//   2. 垃圾字节直接丢 (EMI 干扰 → 我们当没看见)
//   3. USB 真断了才走重连流程,只是数据噪声不算断
//
// Arduino 端协议:
//   每行 ASCII 数字,逗号分隔, \n 结尾
//   例如: "1234,5678,901,234\n"
// 波特率 115200

class ArduinoSerial {
  constructor(baudRate = 115200) {
    this.baudRate = baudRate;
    this.port = null;
    this.reader = null;
    this.connected = false;
    this.userClosed = false;
    this.latestValues = [];
    this.onValues = null;
    this.onDisconnect = null;
    this.onReconnect = null;
    this._buffer = '';
    this._reconnectTimer = null;
  }

  async connect() {
    if (!('serial' in navigator)) {
      alert('当前浏览器不支持 Web Serial。\n请用最新版 Chrome 或 Edge。');
      return false;
    }
    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: this.baudRate });
      this.connected = true;
      this.userClosed = false;
      this._readLoop();
      return true;
    } catch (e) {
      console.error('连接失败:', e);
      return false;
    }
  }

  // 直接读 Uint8Array,跳过 TextDecoderStream
  // 这样 EMI 引起的坏字节不会让整个流崩溃
  async _readLoop() {
    try {
      this.reader = this.port.readable.getReader();
    } catch (e) {
      // 端口处于不可读状态
      this._handleDrop();
      return;
    }

    try {
      while (this.connected) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (!(value instanceof Uint8Array)) continue;
        // 字节级解析: 只接受可打印 ASCII + \n,其他丢
        for (let i = 0; i < value.length; i++) {
          const b = value[i];
          if (b === 10) {                   // \n
            this._handleLine(this._buffer);
            this._buffer = '';
          } else if (b === 13) {            // \r 忽略
            continue;
          } else if (b >= 32 && b <= 126) { // 可打印
            this._buffer += String.fromCharCode(b);
            // 防止 buffer 失控 (EMI 没有 \n 一直堆)
            if (this._buffer.length > 256) this._buffer = '';
          }
          // 其他字节 (大于 127,控制符) 一律丢
        }
      }
    } catch (e) {
      // 真的断了 (USB 拔掉/设备 reset) 才会到这
      console.warn('串口读取中断:', e && e.message);
    } finally {
      this._handleDrop();
    }
  }

  _handleDrop() {
    this.connected = false;
    if (this.reader) {
      try { this.reader.releaseLock(); } catch (_) {}
      this.reader = null;
    }
    this._buffer = '';
    if (this.onDisconnect) this.onDisconnect();
    if (!this.userClosed) this._scheduleReconnect(100);
  }

  _scheduleReconnect(delayMs) {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => this._tryReconnect(), delayMs);
  }

  async _tryReconnect() {
    if (this.userClosed || this.connected) return;
    try {
      try { await this.port.close(); } catch (_) {}
      await new Promise(r => setTimeout(r, 80));
      await this.port.open({ baudRate: this.baudRate });
      this.connected = true;
      this._readLoop();
      if (this.onReconnect) this.onReconnect();
      return;
    } catch (e) {
      // 端口对象失效 → 用 getPorts() 找之前授权过的
      try {
        const ports = await navigator.serial.getPorts();
        if (ports.length > 0) {
          this.port = ports[0];
          await this.port.open({ baudRate: this.baudRate });
          this.connected = true;
          this._readLoop();
          if (this.onReconnect) this.onReconnect();
          return;
        }
      } catch (_) {}
      this._scheduleReconnect(300);
    }
  }

  _handleLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;
    const nums = trimmed
      .split(',')
      .map(s => parseFloat(s.trim()))
      .filter(n => Number.isFinite(n));
    if (nums.length > 0) {
      this.latestValues = nums;
      if (this.onValues) this.onValues(nums);
    }
  }

  async disconnect() {
    this.userClosed = true;
    this.connected = false;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    try {
      if (this.reader) await this.reader.cancel();
      if (this.port) await this.port.close();
    } catch (e) {
      console.error('断开出错:', e);
    }
  }
}
