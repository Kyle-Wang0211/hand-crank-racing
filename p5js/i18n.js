// 简单 i18n — 所有可见文字走 t() 函数
// 语言选择会持久化到 localStorage

const TRANSLATIONS = {
  zh: {
    'ui.connectArduino':     '连接 Arduino (可选)',
    'ui.connected':          '已连接',
    'ui.notConnected':       '未连接 — 玩家1 按 <kbd>{k1}</kbd>,玩家2 按 <kbd>{k2}</kbd>',
    'ui.serialConnected':    '串口已连接 — 最新值: [{values}]',
    'ui.serialDisconnected': '串口已断开 — 切回键盘控制',
    'ui.unsupportedBrowser': '当前浏览器不支持 Web Serial。\n请用最新版 Chrome 或 Edge。',
    'game.title':            '手摇发电 双人赛跑',
    'game.p1Mash':           '玩家1: 狂按 [{k}]',
    'game.p2Mash':           '玩家2: 狂按 [{k}]',
    'game.p1Crank':          '玩家1: 摇电机 (A0)',
    'game.p2Crank':          '玩家2: 摇电机 (A1)',
    'game.serialHint':       '硬件到货后,点左上角"连接 Arduino"切换成手摇控制',
    'game.crankToStart':     '摇任一电机开始比赛 🏁',
    'game.startAny':         '任一玩家按键开始比赛',
    'game.startBtn':         '🏁 开始比赛',
    'game.retryBtn':         '🔄 再来一局',
    'game.racing':           '比赛中...',
    'game.finished':         '比赛结束',
    'game.winnerSuffix':     '获胜!',
    'game.pressRToRetry':    '按 [R] 再来一局',
    'game.inputKeyboard':    '输入: 键盘 P1={k1}  P2={k2}',
    'game.inputSerial':      '输入: 串口 (Arduino)',
    'label.speed':           '速度',
    'label.crankRate':       '摇速',
    'label.time':            '时间',
    'label.distance':        '距离',
    'label.serial':          '串口',
    'label.player1':         '玩家1',
    'label.player2':         '玩家2',
  },
  en: {
    'ui.connectArduino':     'Connect Arduino (optional)',
    'ui.connected':          'Connected',
    'ui.notConnected':       'Not connected — P1 press <kbd>{k1}</kbd>, P2 press <kbd>{k2}</kbd>',
    'ui.serialConnected':    'Serial connected — latest: [{values}]',
    'ui.serialDisconnected': 'Serial disconnected — using keyboard',
    'ui.unsupportedBrowser': 'This browser does not support Web Serial.\nUse the latest Chrome or Edge.',
    'game.title':            'Hand-Crank Racing',
    'game.p1Mash':           'Player 1: mash [{k}]',
    'game.p2Mash':           'Player 2: mash [{k}]',
    'game.p1Crank':          'Player 1: crank (A0)',
    'game.p2Crank':          'Player 2: crank (A1)',
    'game.serialHint':       'Once hardware arrives, click "Connect Arduino" to use the cranks',
    'game.crankToStart':     'Crank any generator to start 🏁',
    'game.startAny':         'Either player press key to start',
    'game.startBtn':         '🏁 Start Race',
    'game.retryBtn':         '🔄 Race Again',
    'game.racing':           'Racing...',
    'game.finished':         'Finished',
    'game.winnerSuffix':     'wins!',
    'game.pressRToRetry':    'Press [R] to retry',
    'game.inputKeyboard':    'Input: Keyboard P1={k1}  P2={k2}',
    'game.inputSerial':      'Input: Serial (Arduino)',
    'label.speed':           'Speed',
    'label.crankRate':       'Crank',
    'label.time':            'Time',
    'label.distance':        'Distance',
    'label.serial':          'Serial',
    'label.player1':         'Player 1',
    'label.player2':         'Player 2',
  }
};

let currentLang = localStorage.getItem('lang') || 'zh';

function t(key, params = {}) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.zh;
  const raw = dict[key] ?? TRANSLATIONS.zh[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''));
}

function setLang(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  applyLangToDOM();
  updateLangButtons();
}

function applyLangToDOM() {
  const connectBtn = document.getElementById('connectBtn');
  if (connectBtn) {
    const isConnected = connectBtn.dataset.connected === '1';
    connectBtn.textContent = isConnected ? t('ui.connected') : t('ui.connectArduino');
  }
  if (typeof renderStatus === 'function') renderStatus();
}

function updateLangButtons() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
  document.documentElement.lang = currentLang;
  updateLangButtons();
  applyLangToDOM();
});
