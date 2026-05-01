// 简单 i18n — 所有可见文字走 t() 函数
// 语言选择会持久化到 localStorage

const TRANSLATIONS = {
  zh: {
    'ui.connectArduino':     '连接 Arduino (可选)',
    'ui.connected':          '已连接',
    'ui.notConnected':       '未连接 — 玩家1 按 <kbd>{k1}</kbd>,玩家2 按 <kbd>{k2}</kbd>',
    'ui.serialConnected':    '串口已连接 — 最新值: [{values}]',
    'ui.serialDisconnected': '串口已断开 — 切回键盘控制',
    'ui.reconnecting':       '⚠ 串口短暂断开,自动重连中...',
    'ui.serialReconnected':  '✓ 已重新连接',
    'ui.unsupportedBrowser': '当前浏览器不支持 Web Serial。\n请用最新版 Chrome 或 Edge。',
    'game.title':            '手摇发电 双人赛跑',
    'game.p1Mash':           '玩家1: 狂按 [{k}]',
    'game.p2Mash':           '玩家2: 狂按 [{k}]',
    'game.p1Crank':          '玩家1: 摇电机 (A2)',
    'game.p2Crank':          '玩家2: 摇电机 (A7)',
    'game.serialHint':       '硬件到货后,点左上角"连接 Arduino"切换成手摇控制',
    'game.crankToStart':     '摇任一电机开始比赛 🏁',
    'game.startAny':         '任一玩家按键开始比赛',
    'game.startBtn':         '🏁 开始比赛',
    'game.retryBtn':         '🔄 再来一局',
    'lobby.title':           '准备阶段',
    'lobby.clickToReady':    '点击此卡 → 准备',
    'lobby.orKey':           '或按 [{k}] 键',
    'lobby.orCrank':         '或摇电机 / 按 [{k}]',
    'lobby.readyOK':         '✓ 已准备',
    'lobby.waiting':         '等待所有玩家就绪...',
    'lobby.allReady':        '✨ 全员就绪!倒数开始 ✨',
    'countdown.title':       '倒数中...',
    'countdown.go':          'GO!',
    'rank.byTime':           '⏱ 完赛时间',
    'rank.byDistance':       '📏 距离 / 进度',
    'rank.tied':             '并列',
    'rank.dnf':              '未完成',
    // Monitor 监测页
    'monitor.title':         '电机转动监测',
    'monitor.subtitle':      '看 ADC 抖动幅度 (peak-to-peak) — 抖动 = 电机在转,死平 = 没转',
    'monitor.statusInit':    '未连接 — 先关掉游戏标签页,再点这里连接',
    'monitor.backToGame':    '← 回到游戏',
    'monitor.thresholdLabel':'启动门槛 PP =',
    'monitor.sliderHint':    '调小 = 更灵敏 / 调大 = 更难触发',
    'monitor.sliderNote':    '(只影响监测页显示,不影响游戏)',
    'monitor.player1':       '玩家1 / 红色',
    'monitor.player2':       '玩家2 / 蓝色',
    'monitor.notSpinning':   '⏸ 没转',
    'monitor.spinning':      '✅ 在转',
    'monitor.amplitudeLabel':'抖动幅度 (peak-to-peak)',
    'monitor.howToHead':     '怎么看:',
    'monitor.howToBody':     '白色竖线是<strong>启动门槛</strong>。彩色条超过白线 → 上面变成 "✅ 在转"。没超过 → "⏸ 没转",哪怕电压还是 25V 也不动。',
    'monitor.tipHead':       '提示:',
    'monitor.tipBody':       '如果你拼命摇但 PP 数字一直 &lt; 门槛,说明你的<strong>电容把信号削得太死</strong>,软件检测不到 ripple。可以拆掉那个大电容,或者并一个小电阻让它快速放电。',
    'monitor.connected':     '已连接 — 摇电机看效果',
    'monitor.connectFail':   '连接失败 (端口可能被游戏占用?关掉游戏标签再试)',
    'monitor.disconnect':    '⚠ 短暂断开,自动重连中...',
    'monitor.reconnect':     '✓ 已重新连接 — 继续摇',
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
    'ui.reconnecting':       '⚠ Serial dropped, auto-reconnecting...',
    'ui.serialReconnected':  '✓ Reconnected',
    'ui.unsupportedBrowser': 'This browser does not support Web Serial.\nUse the latest Chrome or Edge.',
    'game.title':            'Hand-Crank Racing',
    'game.p1Mash':           'Player 1: mash [{k}]',
    'game.p2Mash':           'Player 2: mash [{k}]',
    'game.p1Crank':          'Player 1: crank (A2)',
    'game.p2Crank':          'Player 2: crank (A7)',
    'game.serialHint':       'Once hardware arrives, click "Connect Arduino" to use the cranks',
    'game.crankToStart':     'Crank any generator to start 🏁',
    'game.startAny':         'Either player press key to start',
    'game.startBtn':         '🏁 Start Race',
    'game.retryBtn':         '🔄 Race Again',
    'lobby.title':           'Ready Up',
    'lobby.clickToReady':    'Click this card to ready',
    'lobby.orKey':           'or press [{k}]',
    'lobby.orCrank':         'or crank / press [{k}]',
    'lobby.readyOK':         '✓ Ready',
    'lobby.waiting':         'Waiting for all players...',
    'lobby.allReady':        '✨ All ready! Countdown starting ✨',
    'countdown.title':       'Counting down...',
    'countdown.go':          'GO!',
    'rank.byTime':           '⏱ Finish time',
    'rank.byDistance':       '📏 Distance / progress',
    'rank.tied':             'Tied',
    'rank.dnf':              'DNF',
    // Monitor
    'monitor.title':         'Rotation Monitor',
    'monitor.subtitle':      'Watch ADC peak-to-peak — fluctuating = motor spinning, flat = stopped',
    'monitor.statusInit':    'Not connected — close the game tab first, then click here',
    'monitor.backToGame':    '← Back to game',
    'monitor.thresholdLabel':'Trigger PP =',
    'monitor.sliderHint':    'Smaller = more sensitive / Larger = harder to trigger',
    'monitor.sliderNote':    '(monitor display only — does not affect the game)',
    'monitor.player1':       'Player 1 / Red',
    'monitor.player2':       'Player 2 / Blue',
    'monitor.notSpinning':   '⏸ Not spinning',
    'monitor.spinning':      '✅ Spinning',
    'monitor.amplitudeLabel':'Amplitude (peak-to-peak)',
    'monitor.howToHead':     'How to read:',
    'monitor.howToBody':     'The white vertical line is the <strong>trigger threshold</strong>. When the colored bar passes the white line → it shows "✅ Spinning". Otherwise → "⏸ Not spinning", even if voltage stays high.',
    'monitor.tipHead':       'Tip:',
    'monitor.tipBody':       'If you crank hard but PP stays &lt; threshold, your <strong>capacitor is smoothing the signal too much</strong> — software cannot detect the ripple. Remove the large cap, or add a small bleed resistor in parallel.',
    'monitor.connected':     'Connected — crank to see the effect',
    'monitor.connectFail':   'Connection failed (port may be busy with game tab — close it and retry)',
    'monitor.disconnect':    '⚠ Brief disconnect — auto-reconnecting...',
    'monitor.reconnect':     '✓ Reconnected — keep cranking',
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
  // 通用: 任何带 data-i18n 的元素自动翻译
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = t(el.dataset.i18n);
  });
  // 连接按钮特殊处理 (有动态状态)
  const connectBtn = document.getElementById('connectBtn');
  if (connectBtn) {
    const isConnected = connectBtn.dataset.connected === '1';
    connectBtn.textContent = isConnected ? t('ui.connected') : t('ui.connectArduino');
  }
  if (typeof renderStatus === 'function') renderStatus();
  if (typeof renderMonitorI18n === 'function') renderMonitorI18n();
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
