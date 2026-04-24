// Web Serial API 封装 (支持单值或多值,用逗号分隔)
// Arduino 端协议:
//   单值游戏: Serial.println(v1);        -> onValues([v1])
//   双值游戏: Serial.print(v1);
//             Serial.print(',');
//             Serial.println(v2);         -> onValues([v1, v2])
// 波特率 115200

class ArduinoSerial {
  constructor(baudRate = 115200) {
    this.baudRate = baudRate;
    this.port = null;
    this.reader = null;
    this.connected = false;
    this.latestValues = [];
    this.onValues = null;         // (numberArray) => void
    this.onDisconnect = null;     // () => void
    this._buffer = '';
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
      this._readLoop();
      return true;
    } catch (e) {
      console.error('连接失败:', e);
      return false;
    }
  }

  async _readLoop() {
    const decoder = new TextDecoderStream();
    this.port.readable.pipeTo(decoder.writable).catch(() => {});
    this.reader = decoder.readable.getReader();

    try {
      while (this.connected) {
        const { value, done } = await this.reader.read();
        if (done) break;
        this._buffer += value;
        const lines = this._buffer.split('\n');
        this._buffer = lines.pop();
        for (const line of lines) {
          this._handleLine(line);
        }
      }
    } catch (e) {
      console.error('串口读取出错:', e);
    } finally {
      this.connected = false;
      if (this.onDisconnect) this.onDisconnect();
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
    this.connected = false;
    try {
      if (this.reader) await this.reader.cancel();
      if (this.port) await this.port.close();
    } catch (e) {
      console.error('断开出错:', e);
    }
  }
}
