// 手摇发电 双人赛跑
// 状态机: lobby (准备) → countdown (3-2-1) → racing (比赛) → finished (排名)
// 输入:
//   键盘: 玩家1 = A 键, 玩家2 = L 键
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
const SERIAL_MIN_TO_MOVE = 300;
const SERIAL_STALE_MS = 600;
// 全新策略: 不看电压绝对值,看 ADC 抖动幅度 (peak-to-peak)
// 电机转动 → ADC 在小范围波动 (commutator ripple)
// 电机静止 → ADC 死平 (无论电容存了多少电)
const RAW_HISTORY_SIZE = 12;     // 滑动窗口: ~0.6s @ 20Hz
const RAW_PP_MIN = 25;           // 抖动幅度 < 此值 = 没转 (含 ADC 噪声)
const RAW_PP_MAX = 250;          // 抖动幅度 ≥ 此值 = 满速

const READY_CRANK_THRESHOLD = 500;   // 串口模式下,摇得超过此值即视为"准备好"
const COUNTDOWN_MS = 3000;            // 3 秒倒数

// 排名时认为"并列"的容差
const TIE_TIME_MS = 200;              // 完赛时间差 < 200ms = 并列
const TIE_DIST_PX = 80;               // 距离差 < 80 像素 = 并列

const PLAYER_DEFS = [
  { id: 0, nameKey: 'label.player1', color: [235, 80, 80],  key: 'a', keyLabel: 'A' },
  { id: 1, nameKey: 'label.player2', color: [80, 150, 235], key: 'l', keyLabel: 'L' },
];

let arduino;
let useSerial = false;
let players = [];
let state = 'lobby';                  // lobby | countdown | racing | finished
let startTime = 0;
let countdownStartTime = 0;

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
    // 协议: [out1, out2, raw1, raw2] (前两个是归一化,后两个是 ADC 原始值)
    useSerial = true;
    lastSerialUpdate = millis();
    for (let i = 0; i < Math.min(2, players.length); i++) {
      const p = players[i];
      p.serialValue = values[i] || 0;
      // 用 raw 检测抖动 (兼容旧固件: 没有 raw 就用 out 当 raw)
      p.rawValue = values.length >= 4 ? values[2 + i] : values[i] * 4;
      p.rawHistory.push(p.rawValue);
      if (p.rawHistory.length > RAW_HISTORY_SIZE) p.rawHistory.shift();
    }
    setStatus('ui.serialConnected', {
      values: values.slice(0, 2).map(v => v.toFixed(0)).join(', ')
    });
  };
  arduino.onDisconnect = () => {
    useSerial = false;
    setStatus('ui.serialDisconnected');
    // 重置按钮 — 让用户可以再次点击重新连接
    const btn = document.getElementById('connectBtn');
    if (btn) {
      btn.dataset.connected = '';
      btn.disabled = false;
      btn.textContent = t('ui.connectArduino');
    }
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
    ready: false,
    rawValue: 0,
    rawHistory: [],
    rawPP: 0,                  // 当前抖动幅度 (用于 HUD 显示)
  }));
  state = 'lobby';
  startTime = 0;
  countdownStartTime = 0;
}

function draw() {
  background(12, 15, 25);

  updateInputs();

  if (state === 'lobby') {
    updateLobby();
  } else if (state === 'countdown') {
    updateCountdown();
  } else if (state === 'racing') {
    updatePositions();
  }

  drawTracks();
  drawHUD();
  drawOverlay();
  checkFinish();
}

// --- input & physics ---------------------------------------------

function updateInputs() {
  const now = millis();

  // 串口陈旧检测
  const serialStale = useSerial && (now - lastSerialUpdate > SERIAL_STALE_MS);
  if (serialStale) {
    for (const p of players) p.serialValue = 0;
  }

  for (const p of players) {
    p.presses = p.presses.filter(t => now - t < CRANK_WINDOW_MS);
    p.crankRate = p.presses.length;

    let target;
    if (useSerial) {
      // 用 ADC 抖动幅度判断电机有没有在转
      // (绝对值无效,因为电容会存电)
      if (p.rawHistory.length >= 4) {
        let mn = Infinity, mx = -Infinity;
        for (const v of p.rawHistory) {
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
        p.rawPP = mx - mn;
      } else {
        p.rawPP = 0;
      }

      if (p.rawPP < RAW_PP_MIN) {
        target = 0;          // 死平 = 没转
      } else {
        target = map(p.rawPP, RAW_PP_MIN, RAW_PP_MAX, 5, 10, true);
      }
    } else {
      target = map(p.crankRate, 0, MAX_CRANK_RATE, 0, 10, true);
    }
    p.speed += (target - p.speed) * 0.12;
    if (p.speed < 0.01) p.speed = 0;
  }
}

function updateLobby() {
  // 串口模式下: 摇得猛 → 自动准备
  if (useSerial) {
    for (const p of players) {
      if (p.serialValue > READY_CRANK_THRESHOLD) p.ready = true;
    }
  }
  // 全员就绪 → 进入倒数
  if (players.every(p => p.ready)) {
    state = 'countdown';
    countdownStartTime = millis();
    // 清干净倒数前积累的键盘按键
    for (const p of players) p.presses = [];
  }
}

function updateCountdown() {
  if (millis() - countdownStartTime >= COUNTDOWN_MS) {
    state = 'racing';
    startTime = millis();
    for (const p of players) p.presses = [];
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
    if (k === p.key) {
      if (state === 'lobby') {
        p.ready = true;
      } else if (state === 'racing' && !p.finished) {
        p.presses.push(millis());
      }
    }
  }
  if (k === 'r' && state === 'finished') resetGame();
  return false;
}

function mousePressed() {
  if (state === 'lobby') {
    const cards = lobbyCardRects();
    for (let i = 0; i < cards.length; i++) {
      if (isInRect(mouseX, mouseY, cards[i])) {
        players[i].ready = true;
      }
    }
  } else if (state === 'finished') {
    if (isInButton(mouseX, mouseY, retryButtonRect())) resetGame();
  }
}

// --- 几何工具 -----------------------------------------------------

function lobbyCardRects() {
  const cardW = 320, cardH = 320, gap = 60;
  const totalW = cardW * 2 + gap;
  const startX = (CANVAS_W - totalW) / 2;
  const cardY = 130;
  return [0, 1].map(i => ({
    x: startX + i * (cardW + gap),
    y: cardY,
    w: cardW,
    h: cardH,
  }));
}

function retryButtonRect() {
  return { x: CANVAS_W / 2, y: CANVAS_H - 60, w: 240, h: 56 };
}

function isInButton(mx, my, r) {
  return mx > r.x - r.w / 2 && mx < r.x + r.w / 2 &&
         my > r.y - r.h / 2 && my < r.y + r.h / 2;
}

function isInRect(mx, my, r) {
  return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
}

// --- 排名计算 (允许并列) -----------------------------------------

// items: 玩家列表
// getValue: (player) => number 排序值
// direction: 'asc' (越小越好) 或 'desc' (越大越好)
// tie: 容差,差距小于此视为并列
// 返回: [{ player, rank, tied }] 已按排名顺序排列
function computeRanking(items, getValue, direction, tie) {
  const sorted = [...items].map(p => ({ player: p, value: getValue(p) }));
  if (direction === 'asc') sorted.sort((a, b) => a.value - b.value);
  else sorted.sort((a, b) => b.value - a.value);

  const result = [];
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && Math.abs(sorted[i].value - sorted[i - 1].value) > tie) {
      rank = i + 1;
    }
    result.push({ player: sorted[i].player, rank, value: sorted[i].value });
  }
  // 标记并列
  const counts = {};
  result.forEach(e => counts[e.rank] = (counts[e.rank] || 0) + 1);
  result.forEach(e => e.tied = counts[e.rank] > 1);
  return result;
}

function rankMedal(rank) {
  return ['🥇', '🥈', '🥉'][rank - 1] || `#${rank}`;
}

// --- 绘制 --------------------------------------------------------

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

  // 屏幕坐标 HUD
  fill(p.color[0], p.color[1], p.color[2]);
  textSize(17);
  textAlign(LEFT, TOP);
  text(`${t(p.nameKey)} [${p.keyLabel}]`, 14, yTop + 10);

  fill(230);
  textSize(12);
  const distTxt = min(p.distance, TRACK_LENGTH).toFixed(0);
  text(
    `${distTxt} / ${TRACK_LENGTH}   ${t('label.speed')} ${p.speed.toFixed(1)}`,
    130, yTop + 14
  );
  if (useSerial) {
    fill(100, 200, 255);
    text(`${t('label.serial')} ${p.serialValue.toFixed(0)}   PP ${(p.rawPP || 0).toFixed(0)}`, 360, yTop + 14);
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
    text(`✓ ${((p.finishTime - startTime) / 1000).toFixed(2)}s`, barX - 8, yTop + 12);
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

  if (state === 'lobby') {
    text(t('lobby.title'), 16, HUD_H / 2);
  } else if (state === 'countdown') {
    text(t('countdown.title'), 16, HUD_H / 2);
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
  if (state === 'lobby') {
    drawLobby();
  } else if (state === 'countdown') {
    drawCountdown();
  } else if (state === 'finished') {
    drawFinished();
  }
}

// --- Lobby (准备界面) --------------------------------------------

function drawLobby() {
  fill(0, 220);
  rect(0, 0, CANVAS_W, CANVAS_H);

  textAlign(CENTER, CENTER);
  fill(255);
  textSize(40);
  textStyle(BOLD);
  text(t('game.title'), CANVAS_W / 2, 70);
  textStyle(NORMAL);

  const cards = lobbyCardRects();
  let isHovering = false;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const r = cards[i];
    const ready = p.ready;
    const hover = !ready && isInRect(mouseX, mouseY, r);
    if (hover) isHovering = true;

    // 卡片底色
    push();
    if (ready) {
      fill(40, 160, 60, 230);
      stroke(80, 220, 100);
      strokeWeight(3);
    } else if (hover) {
      fill(50, 50, 70, 230);
      stroke(p.color[0], p.color[1], p.color[2]);
      strokeWeight(2);
    } else {
      fill(35, 35, 50, 230);
      stroke(p.color[0] * 0.5, p.color[1] * 0.5, p.color[2] * 0.5);
      strokeWeight(2);
    }
    rect(r.x, r.y, r.w, r.h, 14);
    pop();

    noStroke();
    // 玩家名
    fill(p.color);
    textSize(28);
    textStyle(BOLD);
    text(t(p.nameKey), r.x + r.w / 2, r.y + 50);
    textStyle(NORMAL);

    // 小人
    push();
    drawRunner(p, r.x + r.w / 2, r.y + 130);
    pop();

    // 状态
    if (ready) {
      fill(255);
      textSize(34);
      textStyle(BOLD);
      text(t('lobby.readyOK'), r.x + r.w / 2, r.y + 250);
      textStyle(NORMAL);
    } else {
      // 准备方式提示
      fill(255, 220, 100);
      textSize(20);
      textStyle(BOLD);
      text(t('lobby.clickToReady'), r.x + r.w / 2, r.y + 240);
      textStyle(NORMAL);

      fill(180);
      textSize(13);
      const hint = useSerial
        ? t('lobby.orCrank', { k: p.keyLabel })
        : t('lobby.orKey', { k: p.keyLabel });
      text(hint, r.x + r.w / 2, r.y + 270);
    }
  }

  // 全屏底部提示
  fill(180);
  textSize(15);
  const allReady = players.every(p => p.ready);
  if (allReady) {
    fill(100, 230, 120);
    textSize(18);
    textStyle(BOLD);
    text(t('lobby.allReady'), CANVAS_W / 2, CANVAS_H - 40);
    textStyle(NORMAL);
  } else {
    text(t('lobby.waiting'), CANVAS_W / 2, CANVAS_H - 40);
  }

  cursor(isHovering ? HAND : ARROW);
}

// --- Countdown (3-2-1-GO) ---------------------------------------

function drawCountdown() {
  fill(0, 230);
  rect(0, 0, CANVAS_W, CANVAS_H);

  const elapsed = millis() - countdownStartTime;
  const remaining = (COUNTDOWN_MS - elapsed) / 1000;

  let label, color;
  if (remaining > 2) { label = '3'; color = [255, 100, 100]; }
  else if (remaining > 1) { label = '2'; color = [255, 200, 100]; }
  else if (remaining > 0) { label = '1'; color = [255, 240, 100]; }
  else { label = t('countdown.go'); color = [100, 240, 120]; }

  // 数字弹动效果: 一秒内从 1 跌到 0,然后回到 1
  const subPhase = remaining > 0 ? (1 - (remaining % 1)) : 0;
  const popScale = 0.7 + (1 - subPhase) * 0.6;

  push();
  translate(CANVAS_W / 2, CANVAS_H / 2);
  scale(popScale);
  textAlign(CENTER, CENTER);
  fill(color[0], color[1], color[2]);
  textSize(180);
  textStyle(BOLD);
  text(label, 0, 0);
  textStyle(NORMAL);
  pop();

  cursor(ARROW);
}

// --- Finished (双排名) ------------------------------------------

function drawFinished() {
  fill(0, 220);
  rect(0, 0, CANVAS_W, CANVAS_H);

  textAlign(CENTER, CENTER);
  fill(255, 220, 0);
  textSize(40);
  textStyle(BOLD);
  text(`🏁 ${t('game.finished')}`, CANVAS_W / 2, 50);
  textStyle(NORMAL);

  // 计算两个排名
  const byTime = computeRanking(
    players,
    p => p.finished ? (p.finishTime - startTime) : Infinity,
    'asc',
    TIE_TIME_MS
  );
  const byDist = computeRanking(
    players,
    p => p.distance,
    'desc',
    TIE_DIST_PX
  );

  // 排名块布局: 左右两列
  const colY = 110;
  const colW = 380;
  const gap = 40;
  const totalW = colW * 2 + gap;
  const colXLeft = (CANVAS_W - totalW) / 2;
  const colXRight = colXLeft + colW + gap;

  drawRankColumn(colXLeft, colY, colW, t('rank.byTime'), byTime, e => {
    if (!e.player.finished) return t('rank.dnf');
    return `${(e.value / 1000).toFixed(2)}s`;
  });

  drawRankColumn(colXRight, colY, colW, t('rank.byDistance'), byDist, e => {
    return `${e.value.toFixed(0)} / ${TRACK_LENGTH}`;
  });

  // 重玩按钮
  const hover = isInButton(mouseX, mouseY, retryButtonRect());
  drawRetryButton(t('game.retryBtn'), hover);
  cursor(hover ? HAND : ARROW);
}

function drawRankColumn(x, y, w, title, ranking, formatValue) {
  // 标题
  fill(150, 220, 255);
  textSize(20);
  textStyle(BOLD);
  textAlign(CENTER, TOP);
  text(title, x + w / 2, y);
  textStyle(NORMAL);

  // 每一行
  let rowY = y + 50;
  textAlign(LEFT, CENTER);
  for (const entry of ranking) {
    const p = entry.player;
    const rowH = 60;

    // 行底色
    fill(p.color[0], p.color[1], p.color[2], 35);
    rect(x, rowY, w, rowH, 8);

    // 排名徽章
    fill(255);
    textSize(28);
    textAlign(CENTER, CENTER);
    text(rankMedal(entry.rank), x + 35, rowY + rowH / 2);

    // 玩家名
    fill(p.color);
    textSize(20);
    textStyle(BOLD);
    textAlign(LEFT, CENTER);
    let nameText = t(p.nameKey);
    if (entry.tied) nameText += `  (${t('rank.tied')})`;
    text(nameText, x + 75, rowY + rowH / 2);
    textStyle(NORMAL);

    // 数值
    fill(230);
    textSize(18);
    textAlign(RIGHT, CENTER);
    text(formatValue(entry), x + w - 18, rowY + rowH / 2);

    rowY += rowH + 10;
  }
}

function drawRetryButton(label, hover) {
  const btn = retryButtonRect();
  push();
  rectMode(CENTER);
  noStroke();
  fill(hover ? 50 : 40, hover ? 200 : 170, hover ? 80 : 70);
  rect(btn.x, btn.y, btn.w, btn.h, 10);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(20);
  textStyle(BOLD);
  text(label, btn.x, btn.y);
  textStyle(NORMAL);
  pop();
}

// --- 状态栏 (DOM,i18n-aware) ------------------------------------

function setStatus(key, params = {}) {
  currentStatusKey = key;
  currentStatusParams = params;
  renderStatus();
}

function renderStatus() {
  const el = document.getElementById('status');
  if (el) el.innerHTML = t(currentStatusKey, currentStatusParams);
}
