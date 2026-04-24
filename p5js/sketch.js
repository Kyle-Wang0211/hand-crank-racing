// 手摇发电 双人赛跑
// 两个玩家,各一条赛道
// 输入:
//   键盘: 玩家1 = A 键, 玩家2 = L 键 (按键频率模拟摇速)
//   串口: Arduino 读两路模拟值,发 "val1,val2\n"
// 所有可见文字走 t() 函数以支持中英切换

const TRACK_LENGTH = 3000;
const CANVAS_W = 960;
const CANVAS_H = 640;
const HUD_H = 40;
const TRACK_H = 280;
const TRACK_GAP = 10;
const CRANK_WINDOW_MS = 1000;
const MAX_CRANK_RATE = 8;
const SERIAL_MAX = 1000;
const SERIAL_MIN_TO_MOVE = 120;   // 串口值低于此 = 视为静止 (游戏端二次过滤)
const SERIAL_STALE_MS = 600;      // 超过此时长没收到数据 = 视为 0

const PLAYER_DEFS = [
  { id: 0, nameKey: 'label.player1', color: [235, 80, 80],  key: 'a', keyLabel: 'A' },
  { id: 1, nameKey: 'label.player2', color: [80, 150, 235], key: 'l', keyLabel: 'L' },
];

let arduino;
let useSerial = false;
let players = [];
let state = 'menu';          // menu | racing | finished
let startTime = 0;

// 当前状态栏的 i18n 键 (语言切换时重新渲染)
let currentStatusKey = 'ui.notConnected';
let currentStatusParams = { k1: 'A', k2: 'L' };
let lastSerialUpdate = 0;

// --- setup & main loop -------------------------------------------

function setup() {
  const c = createCanvas(CANVAS_W, CANVAS_H);
  c.parent('game');
  resetGame();

  arduino = new ArduinoSerial();
  arduino.onValues = (values) => {
    useSerial = true;
    lastSerialUpdate = millis();
    for (let i = 0; i < players.length && i < values.length; i++) {
      players[i].serialValue = values[i];
    }
    setStatus('ui.serialConnected', {
      values: values.map(v => v.toFixed(0)).join(', ')
    });
  };
  arduino.onDisconnect = () => {
    useSerial = false;
    setStatus('ui.serialDisconnected');
  };

  document.getElementById('connectBtn').addEventListener('click', async () => {
    const ok = await arduino.connect();
    if (ok) {
      const btn = document.getElementById('connectBtn');
      btn.dataset.connected = '1';
      btn.disabled = true;
      btn.textContent = t('ui.connected');
    }
  });

  // 初始状态栏渲染 (用当前语言)
  setStatus('ui.notConnected', { k1: 'A', k2: 'L' });
}

function resetGame() {
  players = PLAYER_DEFS.map(def => ({
    ...def,
    distance: 0,
    speed: 0,
    presses: [],
    crankRate: 0,
    serialValue: 0,
    finished: false,
    finishTime: 0,
    place: 0,
  }));
  state = 'menu';
  startTime = 0;
}

function draw() {
  background(12, 15, 25);
  updateInputs();
  if (state === 'racing') updatePositions();
  drawTracks();
  drawHUD();
  drawOverlay();
  checkFinish();
}

// --- input & physics ---------------------------------------------

function updateInputs() {
  const now = millis();

  // 陈旧检测: 超过阈值没收到新数据 = 当前电机都视为 0
  const serialStale = useSerial && (now - lastSerialUpdate > SERIAL_STALE_MS);
  if (serialStale) {
    for (const p of players) p.serialValue = 0;
  }

  for (const p of players) {
    p.presses = p.presses.filter(t => now - t < CRANK_WINDOW_MS);
    p.crankRate = p.presses.length;

    let target;
    if (useSerial) {
      // 游戏端二次阈值 — 串口值低于门槛一律当 0
      // 防止 Arduino 端残余噪声或电机惯性让小人自己走
      const v = p.serialValue < SERIAL_MIN_TO_MOVE ? 0 : p.serialValue;
      target = map(v, 0, SERIAL_MAX, 0, 10, true);
    } else {
      target = map(p.crankRate, 0, MAX_CRANK_RATE, 0, 10, true);
    }
    p.speed += (target - p.speed) * 0.12;
    if (p.speed < 0.01) p.speed = 0;
  }
}

// 开始按钮的位置 (菜单和结束状态共用) — 用于点击检测和绘制
function startButtonRect() {
  return { x: CANVAS_W / 2, y: CANVAS_H / 2 + 90, w: 240, h: 64 };
}

function isInButton(mx, my, r) {
  return mx > r.x - r.w / 2 && mx < r.x + r.w / 2 &&
         my > r.y - r.h / 2 && my < r.y + r.h / 2;
}

function mousePressed() {
  const btn = startButtonRect();
  if (state === 'menu' && isInButton(mouseX, mouseY, btn)) {
    state = 'racing';
    startTime = millis();
    // 清掉菜单期间积累的键盘按键,避免误开局后还带着速度
    for (const p of players) p.presses = [];
  } else if (state === 'finished' && isInButton(mouseX, mouseY, btn)) {
    resetGame();
  }
}

function updatePositions() {
  for (const p of players) {
    if (p.finished) continue;
    p.distance += p.speed;
    if (p.distance >= TRACK_LENGTH) {
      p.distance = TRACK_LENGTH;
      p.finished = true;
      p.finishTime = millis();
      p.place = players.filter(q => q.finished).length;
    }
  }
}

function checkFinish() {
  if (state === 'racing' && players.every(p => p.finished)) {
    state = 'finished';
  }
}

function keyPressed(event) {
  if (event && event.repeat) return false;
  const k = (event && event.key ? event.key : key).toLowerCase();

  for (const p of players) {
    if (k === p.key && !p.finished) {
      p.presses.push(millis());
      // 键盘模式下,按 A/L 可以直接开始(不用点按钮);串口模式强制点按钮
      if (state === 'menu' && !useSerial) {
        state = 'racing';
        startTime = millis();
      }
    }
  }
  if (k === 'r' && state === 'finished') resetGame();
  return false;
}

// --- drawing -----------------------------------------------------

function drawTracks() {
  for (let i = 0; i < players.length; i++) {
    const yTop = HUD_H + i * (TRACK_H + TRACK_GAP);
    drawOneTrack(players[i], yTop);
  }
}

function drawOneTrack(p, yTop) {
  const h = TRACK_H;

  noStroke();
  fill(p.color[0] * 0.12, p.color[1] * 0.12, p.color[2] * 0.25 + 25);
  rect(0, yTop, CANVAS_W, h);

  const camX = constrain(p.distance - 220, 0, TRACK_LENGTH - CANVAS_W + 250);

  push();
  translate(-camX, 0);

  const groundY = yTop + h * 0.58;

  fill(60, 110, 60);
  rect(-100, groundY, TRACK_LENGTH + CANVAS_W + 400, h * 0.42);

  fill(180, 100, 60);
  rect(-100, groundY + 20, TRACK_LENGTH + CANVAS_W + 400, 90);

  stroke(255, 220);
  strokeWeight(3);
  for (let x = 0; x < TRACK_LENGTH; x += 60) {
    line(x, groundY + 65, x + 30, groundY + 65);
  }
  noStroke();

  fill(255);
  rect(0, groundY + 20, 6, 90);

  for (let m = 500; m < TRACK_LENGTH; m += 500) {
    fill(255, 120);
    rect(m, groundY + 20, 2, 90);
    fill(255, 180);
    textSize(11);
    textAlign(LEFT, BOTTOM);
    text(`${m}`, m + 5, groundY + 16);
  }

  drawCheckeredFlag(TRACK_LENGTH, groundY + 20, 30, 90);
  fill(255, 220, 0);
  textSize(14);
  textAlign(LEFT, BOTTOM);
  text('FINISH', TRACK_LENGTH - 10, groundY + 16);

  drawRunner(p, p.distance + 60, groundY + 20);

  pop();

  // 屏幕坐标: 标签 + 进度条
  fill(p.color[0], p.color[1], p.color[2]);
  textSize(17);
  textAlign(LEFT, TOP);
  text(`${t(p.nameKey)} [${p.keyLabel}]`, 14, yTop + 10);

  fill(230);
  textSize(12);
  const distTxt = min(p.distance, TRACK_LENGTH).toFixed(0);
  text(
    `${distTxt} / ${TRACK_LENGTH}   ${t('label.speed')} ${p.speed.toFixed(1)}   ${t('label.crankRate')} ${p.crankRate}/s`,
    130, yTop + 14
  );
  if (useSerial) {
    fill(100, 200, 255);
    text(`${t('label.serial')} ${p.serialValue.toFixed(0)}`, 430, yTop + 14);
  }

  const barX = CANVAS_W - 200, barY = yTop + 14, barW = 180, barH = 12;
  fill(50);
  rect(barX, barY, barW, barH, 6);
  const pct = constrain(p.distance / TRACK_LENGTH, 0, 1);
  fill(p.color);
  rect(barX, barY, barW * pct, barH, 6);

  if (p.finished) {
    fill(255, 220, 0);
    textSize(13);
    textAlign(RIGHT, TOP);
    const medal = p.place === 1 ? '🥇' : '🥈';
    text(`${medal} ${((p.finishTime - startTime) / 1000).toFixed(2)}s`,
         barX - 8, yTop + 12);
  }
}

function drawRunner(p, x, groundY) {
  const bob = sin(frameCount * 0.4 * (p.speed + 1)) * 3;
  const py = groundY - 30 + bob;

  fill(0, 80);
  ellipse(x, groundY + 88, 32, 6);

  const phase = sin(frameCount * 0.5 * (p.speed + 1));
  stroke(40, 40, 80);
  strokeWeight(4);
  line(x - 4, py + 30, x - 4 + phase * 8, py + 52);
  line(x + 4, py + 30, x + 4 - phase * 8, py + 52);
  noStroke();

  fill(p.color);
  rect(x - 10, py, 20, 32, 4);

  stroke(p.color[0], p.color[1], p.color[2]);
  strokeWeight(5);
  line(x - 10, py + 8, x - 14 - phase * 6, py + 22);
  line(x + 10, py + 8, x + 14 + phase * 6, py + 22);
  noStroke();

  fill(255, 220, 180);
  ellipse(x, py - 8, 22, 22);

  if (p.speed > 3) {
    stroke(255, 255, 255, 160);
    strokeWeight(2);
    for (let i = 0; i < 3; i++) {
      const lx = x - 25 - i * 12;
      line(lx, py + 5 + i * 10, lx - 15, py + 5 + i * 10);
    }
    noStroke();
  }
}

function drawCheckeredFlag(x, y, w, h) {
  const cellH = h / 6;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 2; c++) {
      fill((r + c) % 2 === 0 ? 0 : 255);
      rect(x + c * (w / 2), y + r * cellH, w / 2, cellH);
    }
  }
}

function drawHUD() {
  fill(0, 160);
  rect(0, 0, CANVAS_W, HUD_H);

  fill(255);
  textSize(14);
  textAlign(LEFT, CENTER);

  if (state === 'menu') {
    text(t('game.startAny'), 16, HUD_H / 2);
  } else if (state === 'racing') {
    const elapsed = (millis() - startTime) / 1000;
    text(`${t('game.racing')}   ${elapsed.toFixed(2)}s`, 16, HUD_H / 2);
  } else {
    text(t('game.finished'), 16, HUD_H / 2);
  }

  textAlign(RIGHT, CENTER);
  if (useSerial) {
    fill(100, 220, 255);
    text(t('game.inputSerial'), CANVAS_W - 16, HUD_H / 2);
  } else {
    fill(180);
    text(t('game.inputKeyboard', { k1: 'A', k2: 'L' }), CANVAS_W - 16, HUD_H / 2);
  }
}

function drawOverlay() {
  if (state === 'menu') {
    fill(0, 210);
    rect(0, 0, CANVAS_W, CANVAS_H);
    textAlign(CENTER, CENTER);
    fill(255);
    textSize(44);
    text(t('game.title'), CANVAS_W / 2, CANVAS_H / 2 - 90);
    textSize(20);
    if (useSerial) {
      fill(235, 80, 80);
      text(t('game.p1Crank'), CANVAS_W / 2 - 150, CANVAS_H / 2 - 20);
      fill(80, 150, 235);
      text(t('game.p2Crank'), CANVAS_W / 2 + 150, CANVAS_H / 2 - 20);
    } else {
      fill(235, 80, 80);
      text(t('game.p1Mash', { k: 'A' }), CANVAS_W / 2 - 150, CANVAS_H / 2 - 20);
      fill(80, 150, 235);
      text(t('game.p2Mash', { k: 'L' }), CANVAS_W / 2 + 150, CANVAS_H / 2 - 20);
    }
    drawStartButton(t('game.startBtn'));
  } else if (state === 'finished') {
    fill(0, 210);
    rect(0, 0, CANVAS_W, CANVAS_H);
    textAlign(CENTER, CENTER);

    const sorted = [...players].sort((a, b) => a.finishTime - b.finishTime);
    const winner = sorted[0];

    fill(255, 220, 0);
    textSize(52);
    text(`🏆 ${t(winner.nameKey)} ${t('game.winnerSuffix')}`,
         CANVAS_W / 2, CANVAS_H / 2 - 90);

    let y = CANVAS_H / 2 - 10;
    textSize(22);
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      fill(p.color);
      const medal = i === 0 ? '🥇' : '🥈';
      text(`${medal}  ${t(p.nameKey)}   ${((p.finishTime - startTime) / 1000).toFixed(2)}s`,
           CANVAS_W / 2, y);
      y += 36;
    }

    drawStartButton(t('game.retryBtn'));
  }
}

// 在菜单/结束状态绘制一个可点击的按钮
function drawStartButton(label) {
  const btn = startButtonRect();
  const hovering = isInButton(mouseX, mouseY, btn);
  push();
  rectMode(CENTER);
  noStroke();
  fill(hovering ? 50 : 40, hovering ? 200 : 170, hovering ? 80 : 70);
  rect(btn.x, btn.y, btn.w, btn.h, 10);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(22);
  textStyle(BOLD);
  text(label, btn.x, btn.y);
  textStyle(NORMAL);
  pop();
  // 鼠标指针
  if (hovering) {
    cursor(HAND);
  } else {
    cursor(ARROW);
  }
}

// --- status helpers (i18n-aware) ---------------------------------

function setStatus(key, params = {}) {
  currentStatusKey = key;
  currentStatusParams = params;
  renderStatus();
}

function renderStatus() {
  const el = document.getElementById('status');
  if (el) el.innerHTML = t(currentStatusKey, currentStatusParams);
}
