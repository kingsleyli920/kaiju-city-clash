(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('arena');
  const ctx = canvas.getContext('2d');
  const art = window.KaijuArt;
  const W = 768, H = 432, ROUND_SECONDS = 90, FIXED_STEP = 1 / 60;
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const rand = (low, high) => low + Math.random() * (high - low);
  const distance = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.35);
  const setText = (id, value) => { if ($(id)) $(id).textContent = value; };
  const show = (id, visible) => { if ($(id)) $(id).classList.toggle('hidden', !visible); };
  ctx.imageSmoothingEnabled = false;

  const roster = [
    { id: 'hero', name: '曙光巨人', short: '巨人', tag: '均衡型', color: '#8cdbd3', hp: 110, speed: 112, power: 13, powerStat: 3, speedStat: 3, special: '曙光射线', desc: '出拳稳、射线远。抓住对手蓄力的空隙，先打断，再追击。' },
    { id: 'dino', name: '棘背龙', short: '恐龙', tag: '强攻型', color: '#80bd70', hp: 125, speed: 94, power: 15, powerStat: 4, speedStat: 2, special: '熔火吐息', desc: '踏碎街区的绿色巨兽。生命更厚，近距离的烈焰尤其危险。' },
    { id: 'ape', name: '铁拳巨猿', short: '巨猿', tag: '搏斗型', color: '#c4a4ce', hp: 120, speed: 106, power: 16, powerStat: 5, speedStat: 3, special: '撼地重拳', desc: '近身搏斗的老手。摔投伤害更高，重拳震波能同时击碎周围建筑。' },
    { id: 'beetle', name: '苍蓝甲虫', short: '甲虫', tag: '敏捷型', color: '#8ab8e7', hp: 96, speed: 145, power: 11, powerStat: 2, speedStat: 5, special: '音速冲撞', desc: '街区里最快的巨兽。绕到侧面出手，用冲撞迅速拉近距离。' },
    { id: 'rock', name: '琥珀岩王', short: '岩王', tag: '重装型', color: '#e4b16c', hp: 145, speed: 78, power: 18, powerStat: 5, speedStat: 1, special: '大地震颤', desc: '慢一点，却很难被撼动。厚重岩甲和大范围震波让对手无处贴身。' },
    { id: 'slime', name: '紫雾幽灵', short: '幽灵', tag: '远攻型', color: '#d59ae0', hp: 100, speed: 122, power: 11, powerStat: 2, speedStat: 4, special: '紫雾弹', desc: '在街头滑行的神秘怪兽。移动灵活，能量弹能从远处打开局面。' }
  ];

  const stages = [
    { name: '夕照街区', theme: 'sunset', tag: 'OLD TOWN', sky: '#343f48', horizon: '#a88162', skyline: '#3e5056', ground: '#56675c', road: '#35494e', curb: '#a6a28a', lane: '#d4bc83', accent: '#ffca81', roadsX: [230, 524], roadsY: [186, 280, 382], spawn: [235, 287, 535, 280] },
    { name: '临海码头', theme: 'harbor', tag: 'HARBOR', sky: '#193e50', horizon: '#457b83', skyline: '#234b60', ground: '#52717a', road: '#304d5d', curb: '#9ab6b5', lane: '#d6cc94', accent: '#87e0df', roadsX: [185, 576], roadsY: [213, 317, 382], spawn: [185, 300, 576, 300] },
    { name: '霓虹都心', theme: 'neon', tag: 'NEON CITY', sky: '#211f3c', horizon: '#755570', skyline: '#30304d', ground: '#393c58', road: '#242c44', curb: '#7e738d', lane: '#bb89b4', accent: '#eaa3dc', roadsX: [271, 495], roadsY: [193, 290, 382], spawn: [271, 287, 495, 287] }
  ];

  const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let settings = { sound: true, volume: 55, shake: !reducedMotion, difficulty: 'easy', gameMode: 'arcade' };
  try {
    const saved = JSON.parse(localStorage.getItem('kaiju-city-settings-v2') || '{}');
    if (typeof saved.sound === 'boolean') settings.sound = saved.sound;
    if (typeof saved.shake === 'boolean') settings.shake = saved.shake;
    if (Number.isFinite(saved.volume)) settings.volume = clamp(saved.volume, 0, 100);
    if (['easy', 'normal'].includes(saved.difficulty)) settings.difficulty = saved.difficulty;
    if (['arcade', 'versus', 'practice'].includes(saved.gameMode)) settings.gameMode = saved.gameMode;
  } catch { /* Storage is optional, including private browsing. */ }
  let selected = 0, selectedP2 = 1, difficulty = settings.difficulty;
  let gameMode = settings.gameMode, mode = 'idle', resumeMode = 'playing';
  let stageIndex = 0, pendingNext = false, runFinished = false;
  let player, enemy, buildings = [], particles = [], projectiles = [], rings = [], floating = [];
  let elapsed = 0, runElapsed = 0, countdown = 0, shake = 0, hitStop = 0;
  let score = 0, crushed = 0, maxCombo = 0, pin = null;
  let frameTime = 0, accumulator = 0, worldTime = 0, toastTimer = 0;
  let nextAi = 0, aiIntent = { x: 0, y: 0 }, best = 0, completedRuns = 0;
  let dialogAutoResume = null;
  const controlSources = [new Map(), new Map()];
  const taps = [[], []];
  const actionPresses = [new Set(), new Set()];
  const physicalKeys = new Map();
  const pointerKeys = new Map();
  try {
    best = Number(localStorage.getItem('kaiju-city-best-v2')) || Number(localStorage.getItem('kaiju-city-best-v1')) || 0;
    completedRuns = Number(localStorage.getItem('kaiju-city-clears-v2')) || 0;
  } catch {}

  function saveSettings() {
    settings.difficulty = difficulty;
    settings.gameMode = gameMode;
    try { localStorage.setItem('kaiju-city-settings-v2', JSON.stringify(settings)); } catch {}
  }

  let audioContext = null;
  let nextCrashSound = 0;
  function wakeAudio() {
    if (!settings.sound || settings.volume === 0) return;
    try {
      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
    } catch {}
  }
  function sound(type) {
    if (!settings.sound || settings.volume === 0 || !audioContext || audioContext.state !== 'running') return;
    const now = audioContext.currentTime;
    if (type === 'crash') {
      if (now < nextCrashSound) return;
      nextCrashSound = now + 0.09;
    }
    const tones = {
      punch: [130, 45, 0.10, 'square', 0.065], throw: [90, 25, 0.26, 'sawtooth', 0.08],
      special: [500, 60, 0.40, 'sawtooth', 0.045], count: [650, 420, 0.12, 'square', 0.045],
      win: [440, 880, 0.6, 'triangle', 0.10], loss: [180, 60, 0.5, 'triangle', 0.08],
      crash: [60, 20, 0.20, 'sawtooth', 0.045], select: [550, 720, 0.07, 'triangle', 0.05]
    };
    const tone = tones[type] || tones.punch;
    const osc = audioContext.createOscillator(), gain = audioContext.createGain();
    osc.type = tone[3];
    osc.frequency.setValueAtTime(tone[0], now);
    osc.frequency.exponentialRampToValueAtTime(tone[1], now + tone[2]);
    gain.gain.setValueAtTime(Math.max(0.001, tone[4] * settings.volume / 70), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + tone[2]);
    osc.connect(gain); gain.connect(audioContext.destination);
    osc.start(); osc.stop(now + tone[2]);
  }

  function toast(message) {
    setText('toast', message); show('toast', true); toastTimer = 2.3;
  }
  function status() {
    if (gameMode === 'practice') return '自由练习 · 对手不还手，能量自动补充 · 可随时重置';
    if (gameMode === 'versus') return '1P：WASD + JKL · 2P：方向键 + , . / · P 暂停';
    return '第 ' + (stageIndex + 1) + ' / 3 关 · J 攻击 · K 摔投 / 压制 · L 必杀';
  }
  function syncUI() {
    const locked = !['idle', 'result'].includes(mode);
    document.querySelectorAll('button[data-mode]').forEach(button => {
      const active = button.dataset.mode === gameMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      button.disabled = locked;
    });
    document.querySelectorAll('[data-difficulty]').forEach(button => {
      const active = button.dataset.difficulty === difficulty;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      button.disabled = locked || gameMode !== 'arcade';
    });
    document.querySelectorAll('.fighter-card').forEach(button => { button.disabled = locked; });
    show('p2Panel', gameMode === 'versus');
    show('p2Controls', gameMode === 'versus');
    show('practiceResetButton', gameMode === 'practice' && ['playing', 'paused'].includes(mode));
    setText('stageLabel', stages[stageIndex].name);
    setText('roundProgress', gameMode === 'arcade' ? '第 ' + (stageIndex + 1) + ' / 3 关' : gameMode === 'versus' ? '1P VS 2P' : '自由练习');
    setText('modeDescription', {
      arcade: '连闯三座城市，击败三位对手，把总分带到最后。',
      versus: '同一台电脑，两个人一决高下。2P 使用方向键与 , . /。',
      practice: '没有时间限制。练出招、练拆楼，也可以反复练习三秒压制。'
    }[gameMode]);
    setText('startTitle', { arcade: '这一局，轮到你。', versus: '谁是城市之王？', practice: '先把手感找回来。' }[gameMode]);
    setText('startHint', gameMode === 'versus' ? '1P：WASD + JKL；2P：方向键 + , . /' : gameMode === 'practice' ? '对手不还手，必杀能量会自动补充。' : '打倒对手后，靠近按 K，压制 3 秒。');
    setText('startButton', gameMode === 'practice' ? '开始练习 ↗' : gameMode === 'versus' ? '双人开战 ↗' : '进入战斗 ↗');
    setText('recordText', 'BEST ' + String(best).padStart(6, '0'));
    $('soundButton').setAttribute('aria-pressed', String(settings.sound));
    const soundLabel = $('soundButton').querySelector('span');
    if (soundLabel) soundLabel.textContent = settings.sound ? '声音开' : '声音关';
    if ($('volumeSlider')) $('volumeSlider').value = settings.volume;
    if ($('shakeToggle')) $('shakeToggle').checked = settings.shake;
    if (document.body) document.body.dataset.mode = gameMode;
  }

  function makeFighter(index, x, y, face, isPlayer) {
    const def = roster[index];
    return {
      def, x, y, face, isPlayer, controller: isPlayer ? 0 : gameMode === 'versus' ? 1 : -1,
      hp: def.hp, displayHp: def.hp, energy: 60, attackCd: 0, grabCd: 0, specialCd: 0,
      stun: 0, invuln: 0, down: 0, pose: 'idle', poseTime: 0, poseLength: 0.4,
      vx: 0, vy: 0, combo: 0, comboTimer: 0, comboDisplay: 0,
      walkPhase: 0, walk: false, cast: 0, castDuration: 0, castAim: { x: 1, y: 0 },
      recoveries: 0, hitCount: 0, damageDone: 0, popupCd: 0
    };
  }
  function createCity() {
    const layouts = [
      [[52,151,34,49],[108,148,39,66],[167,157,30,36],[305,146,37,58],[360,151,34,40],[432,151,34,63],[608,146,35,50],[668,152,36,68],[719,154,26,39],
       [55,236,37,53],[115,233,42,66],[166,241,31,37],[310,234,37,62],[366,232,31,46],[433,235,33,57],[607,234,35,49],[662,239,41,65],[716,234,28,40],
       [57,337,35,47],[115,338,39,65],[164,333,30,36],[311,335,38,56],[365,337,33,43],[431,339,33,63],[604,337,33,51],[663,337,39,62],[716,332,28,35]],
      [[54,178,53,28],[121,175,37,36],[265,172,49,35],[333,175,48,24],[402,172,51,30],[470,176,40,32],[657,175,52,34],[716,173,27,48],
       [54,268,47,28],[117,268,42,26],[267,267,42,40],[335,267,46,23],[407,267,40,28],[475,267,42,34],[655,267,48,26],[716,267,28,36],
       [68,357,57,28],[275,358,53,32],[350,357,53,25],[428,359,54,30],[652,357,57,26],[719,356,27,32]],
      [[43,151,32,63],[96,151,38,71],[157,152,34,58],[211,152,28,46],[342,149,39,72],[406,151,39,80],[568,151,35,67],[626,151,38,73],[687,151,38,58],[733,156,20,45],
       [54,241,41,67],[117,243,39,56],[179,241,45,74],[346,242,43,62],[416,242,40,72],[576,242,42,61],[641,242,40,76],[712,242,40,52],
       [51,343,39,57],[114,343,40,70],[182,343,38,61],[346,343,43,78],[416,343,39,64],[579,343,40,69],[647,343,42,60],[715,343,33,53]]
    ];
    buildings = layouts[stageIndex].map((v, i) => ({
      x: v[0], y: v[1], w: v[2], h: v[3], depth: stageIndex === 1 ? 13 : 10,
      health: 1, variant: (i + stageIndex * 2) % 7, seed: i,
      theme: stages[stageIndex].theme, destroyed: false
    }));
  }
  function resetScene(keepRun = false) {
    createCity(); particles = []; projectiles = []; rings = []; floating = []; pin = null;
    if (!keepRun) { score = 0; crushed = 0; maxCombo = 0; runElapsed = 0; }
    elapsed = 0; shake = 0; hitStop = 0; nextAi = 0.5;
    aiIntent = { x: 0, y: 0 };
    const offsets = [1, 3, 4];
    const enemyIndex = gameMode === 'versus' ? selectedP2 : gameMode === 'practice' ? 4 : (selected + offsets[stageIndex]) % roster.length;
    const spawn = stages[stageIndex].spawn;
    player = makeFighter(selected, spawn[0], spawn[1], 1, true);
    enemy = makeFighter(enemyIndex, spawn[2], spawn[3], -1, false);
    clearControls(); show('pinBanner', false); show('toast', false); toastTimer = 0;
  }
  function selectFighter(index, controller = 0) {
    if (!['idle', 'result'].includes(mode)) return;
    if (controller === 1) selectedP2 = index; else selected = index;
    const container = controller === 1 ? $('p2Roster') : $('roster');
    if (container) container.querySelectorAll('.fighter-card').forEach((button, i) => {
      button.classList.toggle('selected', i === index);
      button.setAttribute('aria-pressed', String(i === index));
      const mark = button.querySelector('.selection-mark');
      if (mark) mark.textContent = i === index ? '◆' : '';
    });
    const d = roster[index];
    if (controller === 1) setText('p2FighterName', d.name);
    else {
      setText('fighterName', d.name); setText('fighterTag', d.tag);
      setText('fighterDescription', d.desc); setText('specialName', d.special);
      ['power', 'speed'].forEach(name => {
        const node = $(name + 'Stat');
        if (node) node.replaceChildren(...Array.from({ length: 5 }, (_, i) => {
          const e = document.createElement('i'); e.className = i < d[name + 'Stat'] ? 'filled' : ''; return e;
        }));
      });
    }
    if (mode === 'idle') resetScene();
    else { pendingNext = false; runFinished = true; setText('againButton', '重新开战 ↗'); }
    sound('select');
  }
  function buildRoster(containerId, controller) {
    const container = $(containerId);
    if (!container) return;
    roster.forEach((d, i) => {
      const button = document.createElement('button');
      button.className = 'fighter-card';
      button.setAttribute('aria-label', (controller === 1 ? '2P ' : '') + d.name + '，' + d.tag);
      button.setAttribute('aria-pressed', 'false');
      const image = document.createElement('canvas');
      image.width = 110; image.height = 94; image.setAttribute('aria-hidden', 'true');
      const imageCtx = image.getContext('2d'); imageCtx.imageSmoothingEnabled = false;
      art.drawMonster(imageCtx, d.id, 55, 88, { scale: 0.99, facing: controller === 1 ? -1 : 1, pose: 'idle', phase: i * 0.13 });
      const name = document.createElement('span'); name.textContent = d.short;
      const mark = document.createElement('span'); mark.className = 'selection-mark';
      button.append(image, name, mark); button.addEventListener('click', () => selectFighter(i, controller));
      container.appendChild(button);
    });
  }
  function startMatch(options = {}) {
    const keepRun = options.keepRun === true;
    if (!keepRun && gameMode === 'arcade') stageIndex = 0;
    pendingNext = false; runFinished = false;
    wakeAudio(); resetScene(keepRun); mode = 'countdown'; countdown = gameMode === 'practice' ? 1 : 3;
    ['startOverlay', 'resultOverlay', 'pauseOverlay'].forEach(id => show(id, false));
    show('countdown', true); setText('countdown', gameMode === 'practice' ? 'READY' : '3');
    $('pauseButton').disabled = false; setText('pauseButton', 'Ⅱ 暂停');
    setText('battleStatus', status()); syncUI();
    canvas.focus({ preventScroll: true }); sound('count');
  }
  function nextMatch() {
    if (gameMode === 'arcade' && pendingNext && !runFinished) {
      stageIndex++; startMatch({ keepRun: true });
    } else {
      if (gameMode === 'versus') stageIndex = (stageIndex + 1) % stages.length;
      else stageIndex = 0;
      startMatch();
    }
  }
  function returnToSelect() {
    mode = 'idle'; stageIndex = 0; pendingNext = false; runFinished = false;
    resetScene(); ['pauseOverlay', 'resultOverlay', 'countdown', 'pinBanner'].forEach(id => show(id, false));
    show('startOverlay', true); $('pauseButton').disabled = true;
    setText('battleStatus', '等待出战 · 选好角色，就能开始'); syncUI();
  }
  function changeMode(value) {
    if (!['arcade', 'versus', 'practice'].includes(value) || !['idle', 'result'].includes(mode)) return;
    gameMode = value; saveSettings(); returnToSelect(); sound('select');
  }
  function togglePause(force = false) {
    if (mode === 'playing' || mode === 'countdown') {
      resumeMode = mode; mode = 'paused'; clearControls();
      show('pauseOverlay', true); show('countdown', false); show('pinBanner', false);
      setText('pauseButton', '▶ 继续'); setText('battleStatus', '已暂停 · 继续后从原处开战');
      setText('pauseHint', gameMode === 'practice' ? '休息一下，回到练习时对手还在。' : '计时和战斗都会停在这一刻。');
      syncUI();
    } else if (mode === 'paused' && !force) {
      mode = resumeMode; clearControls(); show('pauseOverlay', false);
      setText('pauseButton', 'Ⅱ 暂停'); setText('battleStatus', status());
      if (mode === 'countdown') show('countdown', true);
      wakeAudio(); syncUI(); canvas.focus({ preventScroll: true });
    }
  }
  function resetPracticeDummy() {
    pin = null; show('pinBanner', false);
    const spawn = stages[stageIndex].spawn;
    enemy = makeFighter(enemy.def ? roster.indexOf(enemy.def) : 4, spawn[2], spawn[3], -1, false);
    enemy.invuln = 1; player.energy = 100; player.hp = player.def.hp;
    player.poseTime = 0; player.pose = 'idle'; player.stun = 0;
    projectiles = []; setText('battleStatus', status());
  }
  function finish(winner, reason) {
    if (mode === 'result') return;
    if (gameMode === 'practice') {
      toast('压制成功！对手已重置，继续练习'); score += 250; resetPracticeDummy(); return;
    }
    mode = 'result'; clearControls(); pin = null; projectiles = [];
    show('pinBanner', false); show('countdown', false);
    const won = winner === player;
    runElapsed += elapsed;
    score += won ? 1000 + Math.ceil(player.hp) * 5 + Math.max(0, ROUND_SECONDS - Math.floor(elapsed)) * 5 : 0;
    if (winner) { winner.pose = 'victory'; winner.poseTime = 999; winner.walk = false; }
    if (won) enemy.pose = 'down';
    pendingNext = gameMode === 'arcade' && won && stageIndex < stages.length - 1;
    runFinished = !pendingNext;
    if (gameMode === 'arcade' && score > best) {
      best = score;
      try { localStorage.setItem('kaiju-city-best-v2', String(best)); } catch {}
    }
    if (gameMode === 'arcade' && won && stageIndex === stages.length - 1) {
      completedRuns++;
      try { localStorage.setItem('kaiju-city-clears-v2', String(completedRuns)); } catch {}
    }
    let title, kicker;
    if (gameMode === 'versus') {
      title = winner ? (winner === player ? '1P' : '2P') + '，城市之王！' : '势均力敌。';
      kicker = winner ? 'LOCAL CHAMPION' : 'DRAW GAME';
    } else if (pendingNext) {
      title = stages[stageIndex].name + '，拿下！'; kicker = 'STAGE CLEAR';
      reason += ' 下一站：' + stages[stageIndex + 1].name + '。';
    } else if (won) { title = '三城制霸！'; kicker = 'ARCADE COMPLETE'; }
    else { title = winner ? '下一局，再赢回来。' : '势均力敌。'; kicker = winner ? 'TRY AGAIN' : 'DRAW GAME'; }
    setText('resultTitle', title); setText('resultKicker', kicker); setText('resultReason', reason);
    setText('finalScore', score.toLocaleString()); setText('finalBuildings', crushed);
    setText('finalCombo', maxCombo); setText('finalTime', Math.floor(runElapsed) + 's');
    setText('againButton', pendingNext ? '下一座城市 ↗' : gameMode === 'arcade' ? '再闯三城 ↗' : '下一场对决 ↗');
    setText('selectButton', '返回选角'); show('resultOverlay', true);
    $('pauseButton').disabled = true; setText('battleStatus', pendingNext ? '关卡完成 · 下一关保留总分，生命与城市重置' : '本轮结束 · 随时再来一局');
    sound(won || gameMode === 'versus' && winner ? 'win' : 'loss'); syncUI();
  }

  // A control has independent physical sources: releasing touch must not release a held keyboard key.
  function pressControl(controller, action, source) {
    if (controlSources[controller].has(source)) return;
    controlSources[controller].set(source, action);
    if (action === 'punch') taps[controller].push(action);
    // A quick tap may begin and end between animation frames; retain one action until the next active tick.
    if (mode === 'playing' && !pin && ['punch', 'grab', 'special'].includes(action)) actionPresses[controller].add(action);
  }
  function releaseControl(controller, source) { controlSources[controller].delete(source); }
  function held(controller, action) { return [...controlSources[controller].values()].includes(action); }
  function clearControls() {
    controlSources.forEach(map => map.clear()); taps.forEach(list => { list.length = 0; });
    actionPresses.forEach(actions => actions.clear());
    physicalKeys.clear(); pointerKeys.clear();
    document.querySelectorAll('[data-control]').forEach(button => button.classList.remove('pressed'));
  }
  function mapKey(code) {
    const playerOne = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', KeyJ: 'punch', KeyK: 'grab', KeyL: 'special', Space: 'grab' };
    const arrows = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const playerTwo = { Comma: 'punch', Period: 'grab', Slash: 'special', Numpad1: 'punch', Numpad2: 'grab', Numpad3: 'special' };
    if (playerOne[code]) return [0, playerOne[code]];
    if (arrows[code]) return [gameMode === 'versus' ? 1 : 0, arrows[code]];
    if (gameMode === 'versus' && playerTwo[code]) return [1, playerTwo[code]];
    return null;
  }
  function setPose(f, pose, time) { f.pose = pose; f.poseTime = time; f.poseLength = time; }
  function burst(x, y, color, count = 12, size = 3) {
    for (let i = 0; i < count && particles.length < 400; i++) particles.push({ x, y, vx: rand(-90, 90), vy: rand(-125, 35), life: rand(0.25, 0.7), size: rand(1, size), color });
  }
  function word(message, x, y, color = '#fff3c7', size = 13) { floating.push({ text: message, x, y, life: 0.85, color, size }); }
  function breakBuilding(b, amount, owner) {
    if (b.health <= 0) return;
    b.health = Math.max(0, b.health - amount);
    if (b.health === 0 && !b.destroyed) {
      b.destroyed = true; burst(b.x, b.y - b.h * 0.5, '#c4b098', 18, 5);
      rings.push({ x: b.x, y: b.y, r: 8, max: 35, life: 0.4, color: '#d3b985' });
      shake = Math.max(shake, 2); sound('crash');
      if (owner) {
        owner.energy = clamp(owner.energy + 12, 0, 100);
        if (owner.isPlayer || gameMode === 'versus') { score += 80; crushed++; }
      }
    }
  }
  function destroyNear(x, y, radius, amount, owner) {
    buildings.forEach(b => {
      if (Math.abs(b.x - x) < radius + b.w * 0.45 && Math.abs(b.y - y) < radius * 0.65 + 10) breakBuilding(b, amount, owner);
    });
  }
  function charging(f) { return projectiles.some(p => p.owner === f && p.type === 'charge' && p.life > 0); }
  function canAct(f) { return !f.down && !f.stun && !f.cast && !charging(f) && (!pin || pin.attacker !== f && pin.defender !== f); }
  function dealHit(attacker, target, damage, knock = 20, kind = 'punch') {
    if (target.down || target.invuln > 0 || pin) return false;
    target.hp = Math.max(0, target.hp - damage); target.invuln = 0.24;
    target.stun = kind === 'special' ? 0.4 : kind === 'throw' ? 0.4 : 0.21;
    target.cast = 0;
    projectiles.forEach(p => { if (p.owner === target && p.type === 'charge') p.life = 0; });
    const dx = target.x - attacker.x, dy = target.y - attacker.y;
    const length = Math.hypot(dx, dy) || 1;
    target.vx = dx / length * knock * 8; target.vy = dy / length * knock * 5;
    attacker.energy = clamp(attacker.energy + 8, 0, 100); target.energy = clamp(target.energy + 3, 0, 100);
    attacker.combo = attacker.comboTimer > 0 ? attacker.combo + 1 : 1;
    attacker.comboTimer = 1.65; attacker.comboDisplay = 1.1; attacker.hitCount++; attacker.damageDone += damage;
    if (attacker.isPlayer || gameMode === 'versus') { maxCombo = Math.max(maxCombo, attacker.combo); score += Math.round(damage * 8) + Math.max(0, attacker.combo - 1) * 10; }
    burst(target.x, target.y - 42, attacker.def.color, 13, 4);
    word('-' + Math.round(damage), target.x + rand(-6, 6), target.y - 86);
    if (attacker.combo > 1) word(attacker.combo + ' HIT!', attacker.x, attacker.y - 116, '#ffe095', 16);
    shake = Math.max(shake, kind === 'throw' ? 6 : kind === 'special' ? 5 : 2.5);
    hitStop = kind === 'throw' ? 0.075 : 0.04; sound(kind);
    if (target.hp === 0) {
      target.down = 7; target.stun = 0; target.cast = 0; setPose(target, 'down', 7);
      word('击倒！', target.x, target.y - 106, '#ffcc77', 18);
      if (target.controller === 1) toast('2P 倒地！1P 靠近按 K 压制');
      else if (target.controller === 0) toast(gameMode === 'versus' ? '1P 倒地！2P 靠近按 . 压制' : '你被击倒了！被压制时，快速连按 J 挣脱');
      else toast('对手倒地！靠近按 K，压制 3 秒获胜');
    }
    return true;
  }
  function punch(f, target) {
    if (!canAct(f) || f.attackCd > 0) return;
    f.attackCd = f.def.id === 'beetle' ? 0.31 : 0.4;
    const reach = f.def.id === 'rock' ? 71 : 66;
    if (distance(f, target) < 100) f.face = target.x >= f.x ? 1 : -1;
    const comboFinisher = f.comboTimer > 0 && (f.combo + 1) % 3 === 0;
    setPose(f, comboFinisher ? 'kick' : 'punch', 0.24);
    destroyNear(f.x + f.face * 34, f.y, 34, 0.3, f);
    if (distance(f, target) < reach) dealHit(f, target, f.def.power * (comboFinisher ? 1.2 : 1), comboFinisher ? 26 : 14);
    else burst(f.x + f.face * 36, f.y - 42, '#bac1ad', 3, 2);
  }
  function beginPin(attacker, defender) {
    attacker.face = defender.x >= attacker.x ? 1 : -1;
    pin = { attacker, defender, time: 0, lastCount: 0, escapes: 0 };
    attacker.x = clamp(defender.x - attacker.face * 13, 28, W - 28);
    attacker.y = clamp(defender.y + 3, 150, H - 25);
    setPose(attacker, 'grab', 3);
    attacker.vx = attacker.vy = defender.vx = defender.vy = 0;
    actionPresses.forEach(actions => actions.clear());
    projectiles = []; sound('count');
  }
  function grab(f, target) {
    if (!canAct(f) || f.grabCd > 0) return;
    if (distance(f, target) > 58) {
      if (f.controller >= 0 && f.popupCd <= 0) { toast('再靠近一点，才能摔投 / 压制'); f.popupCd = 1.5; }
      f.grabCd = 0.45; return;
    }
    if (target.down > 0) { beginPin(f, target); return; }
    f.face = target.x >= f.x ? 1 : -1; f.grabCd = 1.4; f.attackCd = 0.5; setPose(f, 'grab', 0.4);
    if (dealHit(f, target, f.def.id === 'ape' ? 25 : 20, 55, 'throw')) {
      destroyNear(target.x + f.face * 40, target.y, 65, 0.7, f);
      word('摔投！', f.x, f.y - 105, '#ffd58c');
    }
  }
  function special(f, target) {
    if (!canAct(f) || f.specialCd > 0) return;
    if (f.energy < 60) {
      if (f.controller >= 0 && f.popupCd <= 0) { toast('必杀需要 60 能量，命中或拆楼可补充'); f.popupCd = 1.8; }
      f.specialCd = 0.35; return;
    }
    f.energy -= 60; f.specialCd = 3.4;
    f.cast = f.controller >= 0 ? 0.35 : difficulty === 'easy' ? 0.8 : 0.65;
    f.castDuration = f.cast; f.face = target.x >= f.x ? 1 : -1;
    const dx = target.x - f.x, dy = target.y - f.y, length = Math.hypot(dx, dy) || 1;
    f.castAim = { x: dx / length, y: dy / length };
    setPose(f, 'special', f.cast + 0.4);
    word(f.def.special, f.x, f.y - 105, f.def.color);
  }
  function fireSpecial(f, target) {
    const id = f.def.id; sound('special');
    if (id === 'ape' || id === 'rock') {
      const radius = id === 'rock' ? 135 : 112;
      rings.push({ x: f.x, y: f.y, r: 5, max: radius, life: 0.65, color: f.def.color });
      destroyNear(f.x, f.y, radius, 0.75, f);
      if (distance(f, target) < radius) dealHit(f, target, id === 'rock' ? 33 : 30, 45, 'special');
      shake = 6;
    } else {
      const type = id === 'beetle' ? 'charge' : id === 'dino' ? 'flame' : id === 'slime' ? 'orb' : 'beam';
      projectiles.push({
        owner: f, x: f.x + f.castAim.x * 25, ground: f.y + f.castAim.y * 25,
        dx: f.castAim.x, dy: f.castAim.y, speed: type === 'charge' ? 390 : type === 'orb' ? 240 : 330,
        life: type === 'flame' ? 0.7 : type === 'charge' ? 0.75 : 1.25,
        type, color: f.def.color, r: type === 'flame' ? 26 : 18, damage: type === 'charge' ? 30 : 29, trailTime: 0
      });
    }
  }
  function moveFighter(f, x, y, dt) {
    f.walk = false;
    if (!canAct(f) || f.poseTime > 0.1 && ['punch', 'kick', 'grab', 'special'].includes(f.pose)) return;
    const length = Math.hypot(x, y);
    if (length > 0) {
      x /= length; y /= length;
      f.x += x * f.def.speed * dt; f.y += y * f.def.speed * 0.73 * dt;
      f.walk = true; f.walkPhase += dt * 2.8;
      if (x) f.face = x > 0 ? 1 : -1;
    }
    f.x = clamp(f.x, 28, W - 28); f.y = clamp(f.y, 150, H - 25);
  }
  function updateFighter(f, other, dt) {
    ['attackCd', 'grabCd', 'specialCd', 'stun', 'invuln', 'comboTimer', 'comboDisplay', 'popupCd'].forEach(key => { f[key] = Math.max(0, f[key] - dt); });
    f.displayHp = Math.max(f.hp, f.displayHp - f.def.hp * dt * 0.65);
    f.poseTime = Math.max(0, f.poseTime - dt);
    if (f.poseTime === 0 && !f.down) f.pose = 'idle';
    if (f.cast > 0) {
      f.cast -= dt;
      if (f.cast <= 0) { f.cast = 0; fireSpecial(f, other); }
    }
    if (!pin || pin.defender !== f && pin.attacker !== f) {
      // Integrate exponential knockback analytically so 30 and 60 FPS have the same travel distance.
      const decay = Math.exp(-9 * dt), travel = (1 - decay) / 9;
      f.x = clamp(f.x + f.vx * travel, 28, W - 28); f.y = clamp(f.y + f.vy * travel, 150, H - 25);
      f.vx *= decay; f.vy *= decay;
    }
    if (f.down > 0 && (!pin || pin.defender !== f)) {
      f.down -= dt;
      if (f.down <= 0) {
        f.down = 0;
        f.hp = gameMode === 'practice' && f === enemy ? f.def.hp : Math.ceil(f.def.hp * 0.22);
        f.displayHp = f.hp; f.invuln = 1.1; f.pose = 'idle'; f.poseTime = 0; f.recoveries++;
        word(gameMode === 'practice' ? '再来！' : '重新站起！', f.x, f.y - 100, f.def.color);
        setText('battleStatus', status());
      }
    }
    if (f.walk || Math.abs(f.vx) > 40 || charging(f)) buildings.forEach(b => {
      if (b.health > 0 && Math.abs(b.x - f.x) < b.w * 0.48 + 10 && Math.abs(b.y - f.y) < 16) breakBuilding(b, dt * (Math.abs(f.vx) > 40 || charging(f) ? 4 : 1.6), f);
    });
    if (gameMode === 'practice' && f === player) f.energy = clamp(f.energy + dt * 25, 0, 100);
  }
  function updateAI(dt) {
    if (gameMode !== 'arcade' || !canAct(enemy)) return;
    nextAi -= dt;
    if (nextAi <= 0) {
      const dx = player.x - enemy.x, dy = player.y - enemy.y, d = distance(enemy, player);
      const intensity = difficulty === 'normal' ? 1 : 0.65 + stageIndex * 0.08;
      nextAi = difficulty === 'easy' ? rand(0.24, 0.4) : rand(0.16, 0.27);
      if (player.down) {
        aiIntent = { x: Math.abs(dx) > 17 ? Math.sign(dx) : 0, y: Math.abs(dy) > 9 ? Math.sign(dy) : 0 };
        if (d < 49) grab(enemy, player);
      } else {
        // Read the visible charge / projectile, not player inputs or future actions.
        const threat = projectiles.find(p => p.owner === player && p.life > 0 && Math.abs(p.x - enemy.x) < 150 && Math.abs(p.ground - enemy.y) < 35);
        if (threat && Math.random() < intensity * 0.7 || player.cast > 0 && d > 80 && Math.random() < intensity * 0.45) {
          aiIntent = { x: 0, y: enemy.y < 270 ? 1 : -1 };
        } else {
          aiIntent = d > 61 ? { x: Math.sign(dx), y: Math.abs(dy) > 12 ? Math.sign(dy) : 0 } : { x: Math.random() < 0.18 ? -Math.sign(dx) : 0, y: Math.abs(dy) > 18 ? Math.sign(dy) : 0 };
          if (d < 66 && Math.random() < intensity * 0.8) punch(enemy, player);
          if (d < 50 && Math.random() < intensity * 0.2) grab(enemy, player);
          const closeSpecial = ['ape', 'rock'].includes(enemy.def.id);
          if (enemy.energy >= 60 && d > 40 && d < (closeSpecial ? 120 : 230) && Math.random() < intensity * 0.16) special(enemy, player);
        }
      }
    }
    moveFighter(enemy, aiIntent.x, aiIntent.y, dt * (difficulty === 'easy' ? 0.82 + stageIndex * 0.04 : 1));
  }
  function updatePin(dt) {
    if (!pin) return;
    const controller = pin.defender.controller;
    if (controller >= 0) for (const action of taps[controller]) if (action === 'punch') { pin.escapes++; sound('punch'); }
    if (pin.escapes >= 8) {
      const f = pin.defender, attacker = pin.attacker;
      f.down = 0; f.hp = Math.ceil(f.def.hp * 0.2); f.displayHp = f.hp;
      f.invuln = 1.3; f.pose = 'idle'; f.poseTime = 0;
      attacker.stun = 0.8; attacker.poseTime = 0; attacker.pose = 'idle';
      attacker.x = clamp(attacker.x - attacker.face * 55, 28, W - 28);
      pin = null; show('pinBanner', false); toast((controller === 1 ? '2P' : '1P') + ' 挣脱成功！'); return;
    }
    pin.time += dt;
    const count = Math.min(3, Math.floor(pin.time) + 1);
    if (count !== pin.lastCount) { pin.lastCount = count; sound('count'); }
    show('pinBanner', true);
    const attackerLabel = pin.attacker === player ? '1P' : gameMode === 'versus' ? '2P' : 'CPU';
    const escapeKey = controller === 1 ? ', / 小键盘 1' : 'J';
    $('pinBanner').innerHTML = attackerLabel + ' 压制中！<strong>' + count + '</strong><small>' +
      (controller >= 0 ? '防守方连按 ' + escapeKey + ' 挣脱 ' + pin.escapes + ' / 8' : '坚持 3 秒，拿下这一局') + '</small>';
    if (pin.time >= 3) finish(pin.attacker, '压制三秒！' + attackerLabel + ' 拿下这一局。');
  }
  function updateProjectiles(dt) {
    projectiles.forEach(p => {
      if (p.life <= 0) return;
      if (p.type === 'charge' && (p.owner.down || p.owner.stun > 0)) { p.life = 0; return; }
      p.life -= dt;
      p.x += p.dx * p.speed * dt; p.ground += p.dy * p.speed * dt;
      if (p.type === 'charge') {
        const newX = p.x - p.dx * 18, newY = p.ground - p.dy * 18;
        p.owner.x = clamp(newX, 28, W - 28); p.owner.y = clamp(newY, 150, H - 25);
        if (newX < 28 || newX > W - 28 || newY < 150 || newY > H - 25) p.life = 0;
      }
      const target = p.owner === player ? enemy : player;
      destroyNear(p.x, p.ground, p.r, dt * 3.9, p.owner);
      if (p.life > 0 && Math.abs(p.x - target.x) < p.r + 23 && Math.abs(p.ground - target.y) < p.r + 9 && !target.down && target.invuln <= 0) {
        if (dealHit(p.owner, target, p.damage, 45, 'special')) p.life = 0;
      }
      p.trailTime += dt;
      if (p.trailTime >= 1 / 30) { p.trailTime = 0; burst(p.x, p.ground - 32, p.color, p.type === 'flame' ? 3 : 1, 3); }
    });
    projectiles = projectiles.filter(p => p.life > 0 && p.x > -40 && p.x < W + 40 && p.ground > 100 && p.ground < H + 30);
  }
  function applyPlayerInput(f, target, controller, dt) {
    const x = (held(controller, 'right') ? 1 : 0) - (held(controller, 'left') ? 1 : 0);
    const y = (held(controller, 'down') ? 1 : 0) - (held(controller, 'up') ? 1 : 0);
    moveFighter(f, x, y, dt);
    const actions = actionPresses[controller];
    const grabPressed = held(controller, 'grab') || actions.has('grab');
    const specialPressed = held(controller, 'special') || actions.has('special');
    const punchPressed = held(controller, 'punch') || actions.has('punch');
    actions.clear();
    // Grappling a downed opponent must win over a held attack button.
    if (grabPressed && target.down) grab(f, target);
    else if (specialPressed) special(f, target);
    else if (grabPressed) grab(f, target);
    else if (punchPressed) punch(f, target);
  }
  function tick(dt) {
    if (mode === 'paused') return;
    worldTime += dt;
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) show('toast', false); }
    particles.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 230 * dt; });
    particles = particles.filter(p => p.life > 0);
    rings.forEach(r => { r.life -= dt; r.r += (r.max - r.r) * (1 - Math.exp(-9 * dt)); });
    rings = rings.filter(r => r.life > 0);
    floating.forEach(f => { f.life -= dt; f.y -= dt * 25; }); floating = floating.filter(f => f.life > 0);
    shake = Math.max(0, shake - dt * 22);
    if (mode === 'countdown') {
      const previous = Math.ceil(countdown); countdown -= dt;
      const current = Math.ceil(countdown);
      if (current !== previous && current > 0) sound('count');
      setText('countdown', countdown < 0.65 ? gameMode === 'practice' ? 'READY!' : 'FIGHT!' : current);
      if (countdown <= 0) {
        mode = 'playing'; show('countdown', false);
        taps.forEach(list => { list.length = 0; });
        syncUI();
      }
      return;
    }
    if (mode !== 'playing') return;
    if (hitStop > 0) { hitStop = Math.max(0, hitStop - dt); return; }
    elapsed += dt;
    if (gameMode !== 'practice' && elapsed >= ROUND_SECONDS && !pin) {
      const a = player.hp / player.def.hp, b = enemy.hp / enemy.def.hp;
      finish(a > b ? player : b > a ? enemy : null, a === b ? '时间到！双方剩余血量相同，本局平手。' : '时间到！按剩余血量比例判定胜负。'); return;
    }
    updateFighter(player, enemy, dt); updateFighter(enemy, player, dt);
    if (pin) {
      actionPresses.forEach(actions => actions.clear());
      updatePin(dt); taps.forEach(list => { list.length = 0; }); return;
    }
    applyPlayerInput(player, enemy, 0, dt);
    if (!pin && gameMode === 'versus') applyPlayerInput(enemy, player, 1, dt);
    else if (!pin && gameMode === 'arcade') updateAI(dt);
    if (!player.down && !enemy.down && !pin) {
      const d = distance(player, enemy);
      if (d < 33 && d > 0) {
        const push = (33 - d) * 0.5, dx = (player.x - enemy.x) / d, dy = (player.y - enemy.y) / d;
        player.x = clamp(player.x + dx * push, 28, W - 28); enemy.x = clamp(enemy.x - dx * push, 28, W - 28);
        player.y = clamp(player.y + dy * push, 150, H - 25); enemy.y = clamp(enemy.y - dy * push, 150, H - 25);
      }
    }
    if (!pin) updateProjectiles(dt);
    taps.forEach(list => { list.length = 0; });
  }

  function rect(x, y, width, height, color) {
    ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }
  function text(value, x, y, size, color, align = 'left', font = 'monospace') {
    ctx.font = 'bold ' + size + 'px ' + font; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color; ctx.fillText(value, x, y);
  }
  function ground() {
    const stage = stages[stageIndex];
    rect(0, 0, W, H, stage.sky); rect(0, 70, W, 65, stage.horizon);
    if (stageIndex === 0) {
      ctx.fillStyle = '#e7b47e'; ctx.beginPath(); ctx.arc(642, 96, 19, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 32; i++) {
      const height = 14 + (i * 17 + stageIndex * 9) % 29;
      rect(i * 25, 116 - height, 20, height, stage.skyline);
      for (let j = 0; j < 3; j++) if ((i + j) % 3 === 0) rect(i * 25 + 4 + j * 4, 119 - height, 2, 3, stageIndex === 2 ? '#e8a1d3' : '#d4bb87');
    }
    rect(0, 124, W, H - 124, stage.ground);
    if (stageIndex === 1) {
      rect(0, 122, W, 25, '#236071');
      for (let i = 0; i < 31; i++) rect((i * 29 + worldTime * 9) % W, 131 + i % 3 * 4, 15, 1, '#72a5ac');
      [92, 424, 679].forEach(x => { rect(x, 86, 4, 61, '#c9aa68'); rect(x, 87, 48, 4, '#c9aa68'); rect(x + 44, 90, 2, 27, '#d7c18d'); rect(x - 5, 141, 15, 6, '#385461'); });
    }
    stage.roadsX.forEach(x => {
      rect(x - 37, 147, 74, H - 147, stage.road); rect(x - 41, 147, 4, H - 147, stage.curb); rect(x + 37, 147, 4, H - 147, stage.curb);
      for (let y = 153; y < H; y += 27) rect(x - 1, y, 2, 12, stage.lane);
    });
    stage.roadsY.forEach(y => {
      rect(0, y - 17, W, 34, stage.road); rect(0, y - 19, W, 2, stage.curb); rect(0, y + 17, W, 2, stage.curb);
      for (let x = 0; x < W; x += 32) rect(x, y, 16, 1, stage.lane);
    });
    stage.roadsX.forEach(x => stage.roadsY.forEach(y => {
      rect(x - 35, y - 17, 70, 34, stage.road);
      for (let i = 0; i < 5; i++) { rect(x - 34 + i * 5, y - 18, 3, 10, stage.curb); rect(x + 13 + i * 5, y + 8, 3, 10, stage.curb); }
    }));
    if (stageIndex === 2) {
      [25, 203, 361, 605, 744].forEach((x, i) => {
        rect(x, 152 + i % 2 * 92, 3, 47, '#31304e'); rect(x - 3, 153 + i % 2 * 92, 9, 3, i % 2 ? '#85ded9' : '#e292ce');
      });
    } else if (stageIndex === 0) {
      for (let i = 0; i < 27; i++) {
        const x = 20 + i * 89 % 730, y = 155 + i * 61 % 247;
        if (stage.roadsX.every(road => Math.abs(x - road) > 50)) { rect(x, y, 9, 4, '#466752'); rect(x + 2, y - 3, 5, 5, '#73936a'); }
      }
    }
    stage.roadsX.forEach((x, k) => {
      for (let i = 0; i < 3; i++) {
        const y = 151 + (i * 78 + worldTime * (k ? 11 : -9) + 3000) % 250;
        rect(x + (k ? 20 : -21), y, 7, 13, k ? '#d1ac7b' : '#80aaa9');
        rect(x + (k ? 21 : -20), y + 3, 5, 4, '#304653');
      }
    });
    rect(0, H - 13, W, 13, stage.skyline);
    for (let x = 10; x < W; x += 28) rect(x, H - 10, 14, 2, stage.curb);
  }
  function drawTelegraph(f) {
    if (f.cast <= 0) return;
    ctx.save(); ctx.globalAlpha = 0.35 + Math.sin(worldTime * 28) * 0.12;
    ctx.strokeStyle = f.def.color; ctx.lineWidth = 2;
    if (['ape', 'rock'].includes(f.def.id)) {
      const radius = f.def.id === 'rock' ? 135 : 112;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, radius, radius * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + f.castAim.x * 230, f.y + f.castAim.y * 230); ctx.stroke();
    }
    ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(f.x, f.y - 40, 27 + Math.sin(worldTime * 30) * 4, 34, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  function drawFighter(f) {
    const isDown = f.down > 0 || f.pose === 'down';
    ctx.save(); ctx.globalAlpha = f.invuln > 0 && Math.floor(worldTime * 15) % 2 === 0 ? 0.6 : 1;
    const pose = isDown ? 'down' : f.poseTime > 0 ? f.pose : f.walk ? 'walk' : 'idle';
    art.drawMonster(ctx, f.def.id, f.x, f.y, {
      scale: 1.08, facing: f.face, pose,
      phase: pose === 'walk' ? f.walkPhase % 1 : pose === 'idle' ? worldTime * 0.55 % 1 : clamp(1 - f.poseTime / f.poseLength, 0, 1), hurt: f.stun > 0.1
    });
    ctx.restore();
    const label = f === player ? '1P' : gameMode === 'versus' ? '2P' : gameMode === 'practice' ? 'DUMMY' : 'CPU';
    if (isDown) {
      text('KO', f.x, f.y - 30, 12, '#ffd88a', 'center');
      if (!pin) text(f === player && gameMode === 'versus' ? '. 压制' : 'K 压制', f.x, f.y - 14, 8, '#f3e5bd', 'center', 'sans-serif');
    } else {
      const color = f === player ? '#92e4cf' : '#ffd09c';
      ctx.beginPath(); ctx.moveTo(f.x - 4, f.y - 99); ctx.lineTo(f.x + 4, f.y - 99); ctx.lineTo(f.x, f.y - 93); ctx.fillStyle = color; ctx.fill();
      text(label, f.x, f.y - 104, 8, color, 'center');
    }
  }
  function drawHud() {
    rect(0, 0, W, 70, '#121f2d'); rect(0, 69, W, 2, stages[stageIndex].accent);
    text('1P', 17, 22, 11, '#88d9c7'); text(player.def.name, 47, 23, 13, '#f1eee0', 'left', 'sans-serif');
    text(enemy.def.name, W - 55, 23, 13, '#f1eee0', 'right', 'sans-serif');
    text(gameMode === 'versus' ? '2P' : gameMode === 'practice' ? 'DUMMY' : 'CPU', W - 16, 22, gameMode === 'practice' ? 8 : 11, '#e5ad83', 'right');
    const width = 274;
    [player, enemy].forEach((f, i) => {
      const x = i ? W - 17 - width : 17;
      const fraction = clamp(f.hp / f.def.hp, 0, 1), trailing = clamp(f.displayHp / f.def.hp, 0, 1);
      rect(x - 1, 31, width + 2, 17, '#566967'); rect(x, 32, width, 15, '#2c3540');
      rect(i ? x + width * (1 - trailing) : x, 32, width * trailing, 15, '#b26055');
      rect(i ? x + width * (1 - fraction) : x, 32, width * fraction, 15, fraction < 0.25 ? '#e89772' : i ? '#d9a578' : '#83cdb1');
      rect(i ? x + width * (1 - fraction) : x, 32, width * fraction, 3, i ? '#f0d0a1' : '#d0e4bf');
      for (let line = 1; line < 10; line++) rect(x + line * width / 10, 32, 1, 15, '#18282b50');
      const ex = i ? W - 127 : 17;
      rect(ex, 53, 110, 5, '#304451');
      rect(i ? ex + 110 * (1 - f.energy / 100) : ex, 53, 110 * f.energy / 100, 5, f.energy >= 60 ? '#e4c36d' : '#769cac');
      rect(ex + (i ? 44 : 66), 51, 1, 9, '#f6eac5');
      if (!i) text(f.energy >= 60 ? 'L READY' : 'ENERGY ' + Math.floor(f.energy), 135, 59, 8, f.energy >= 60 ? '#f0d990' : '#a3bdc1');
      else if (gameMode === 'versus') text(f.energy >= 60 ? '/ READY' : 'ENERGY ' + Math.floor(f.energy), W - 135, 59, 8, f.energy >= 60 ? '#f0d990' : '#a3bdc1', 'right');
    });
    text(gameMode === 'practice' ? '∞' : String(Math.max(0, ROUND_SECONDS - Math.floor(elapsed))).padStart(2, '0'), W / 2, 43, 34, elapsed > 75 && gameMode !== 'practice' ? '#f4ad83' : '#f3e7bc', 'center');
    text(gameMode === 'practice' ? 'PRACTICE' : 'TIME', W / 2, 58, 8, '#9bb1b9', 'center');
    text(stages[stageIndex].tag + '  /  ' + String(score).padStart(6, '0'), W / 2, 83, 8, '#f2d9ac', 'center');
    if (player.combo > 1 && player.comboDisplay > 0) text(player.combo + ' HIT COMBO', 19, 87, 10, '#b5eedb');
    if (gameMode === 'versus' && enemy.combo > 1 && enemy.comboDisplay > 0) text(enemy.combo + ' HIT COMBO', W - 19, 87, 10, '#ffd9ae', 'right');
  }
  function draw() {
    ctx.save(); ctx.clearRect(0, 0, W, H);
    if (settings.shake && shake > 0 && mode === 'playing') ctx.translate(Math.round(rand(-shake, shake)), Math.round(rand(-shake * 0.5, shake * 0.5)));
    ground();
    rings.forEach(r => {
      ctx.save(); ctx.strokeStyle = r.color; ctx.globalAlpha = clamp(r.life * 2, 0, 1); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.45, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    });
    drawTelegraph(player); drawTelegraph(enemy);
    const objects = buildings.map(b => ({ y: b.y, draw: () => art.drawBuilding(ctx, b) }));
    objects.push({ y: player.y, draw: () => drawFighter(player) }, { y: enemy.y, draw: () => drawFighter(enemy) });
    objects.sort((a, b) => a.y - b.y); objects.forEach(object => object.draw());
    projectiles.forEach(p => {
      if (p.type === 'charge') return;
      ctx.save(); ctx.translate(p.x, p.ground - 32); ctx.rotate(Math.atan2(p.dy, p.dx)); ctx.globalAlpha = 0.9;
      if (p.type === 'beam') { rect(-35, -5, 45, 10, p.color); rect(-25, -2, 30, 4, '#fff3c6'); }
      else {
        ctx.fillStyle = p.type === 'flame' ? '#e2a16a' : p.color; ctx.beginPath(); ctx.arc(0, 0, p.r * 0.7, 0, Math.PI * 2); ctx.fill(); rect(-5, -5, 10, 10, '#ffe9bd');
      }
      ctx.restore();
    });
    particles.forEach(p => { ctx.globalAlpha = clamp(p.life * 2, 0, 1); rect(p.x, p.y, p.size, p.size, p.color); }); ctx.globalAlpha = 1;
    floating.forEach(f => { ctx.globalAlpha = clamp(f.life * 2, 0, 1); text(f.text, f.x, f.y, f.size, f.color, 'center', 'sans-serif'); }); ctx.globalAlpha = 1;
    ctx.restore(); drawHud();
  }
  function frame(timestamp) {
    const delta = frameTime ? clamp((timestamp - frameTime) / 1000, 0, 0.12) : FIXED_STEP;
    frameTime = timestamp; accumulator += delta;
    while (accumulator >= FIXED_STEP) { tick(FIXED_STEP); accumulator -= FIXED_STEP; }
    draw(); requestAnimationFrame(frame);
  }

  function anyDialogOpen() { return ['helpDialog', 'settingsDialog'].some(id => $(id) && $(id).open); }
  function openDialog(id) {
    const dialog = $(id); if (!dialog) return;
    dialogAutoResume = ['playing', 'countdown'].includes(mode) ? id : null;
    togglePause(true); clearControls(); dialog.showModal();
  }
  function closeDialog(id) { const dialog = $(id); if (dialog && dialog.open) dialog.close(); }
  ['helpDialog', 'settingsDialog'].forEach(id => {
    const dialog = $(id); if (!dialog) return;
    dialog.addEventListener('close', () => {
      const resume = dialogAutoResume === id && !document.hidden;
      dialogAutoResume = null; clearControls();
      if (resume && mode === 'paused') togglePause();
    });
  });
  document.addEventListener('keydown', event => {
    if (anyDialogOpen()) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target && event.target.tagName)) return;
    if ((event.code === 'KeyP' || event.code === 'Escape') && !event.repeat) {
      event.preventDefault(); togglePause(); return;
    }
    const mapped = mapKey(event.code);
    if (mapped && ['playing', 'countdown'].includes(mode)) {
      event.preventDefault();
      if (!physicalKeys.has(event.code)) {
        physicalKeys.set(event.code, mapped); pressControl(mapped[0], mapped[1], 'key:' + event.code);
      }
    }
    if (event.code === 'Enter' && mode === 'idle' && event.target === canvas) startMatch();
  });
  document.addEventListener('keyup', event => {
    const mapped = physicalKeys.get(event.code);
    if (mapped) { releaseControl(mapped[0], 'key:' + event.code); physicalKeys.delete(event.code); }
  });
  document.querySelectorAll('[data-control]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (!['playing', 'countdown'].includes(mode)) return;
      wakeAudio(); button.setPointerCapture(event.pointerId);
      const action = button.dataset.control; pointerKeys.set(event.pointerId, { action, button });
      pressControl(0, action, 'pointer:' + event.pointerId); button.classList.add('pressed');
    });
    function release(event) {
      const entry = pointerKeys.get(event.pointerId);
      if (!entry) return;
      pointerKeys.delete(event.pointerId); releaseControl(0, 'pointer:' + event.pointerId);
      if (![...pointerKeys.values()].some(other => other.button === button)) button.classList.remove('pressed');
    }
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release); button.addEventListener('contextmenu', event => event.preventDefault());
  });
  function suspend() { dialogAutoResume = null; clearControls(); togglePause(true); }
  window.addEventListener('blur', suspend);
  document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
  $('startButton').addEventListener('click', () => startMatch());
  $('againButton').addEventListener('click', nextMatch);
  $('selectButton').addEventListener('click', returnToSelect); $('quitButton').addEventListener('click', returnToSelect);
  $('pauseButton').addEventListener('click', () => togglePause()); $('resumeButton').addEventListener('click', () => togglePause());
  $('soundButton').addEventListener('click', () => {
    settings.sound = !settings.sound; saveSettings(); syncUI(); if (settings.sound) { wakeAudio(); sound('select'); }
  });
  $('helpButton').addEventListener('click', () => openDialog('helpDialog'));
  $('closeHelp').addEventListener('click', () => closeDialog('helpDialog'));
  $('gotIt').addEventListener('click', () => closeDialog('helpDialog'));
  if ($('settingsButton')) $('settingsButton').addEventListener('click', () => openDialog('settingsDialog'));
  if ($('closeSettings')) $('closeSettings').addEventListener('click', () => closeDialog('settingsDialog'));
  if ($('volumeSlider')) $('volumeSlider').addEventListener('input', event => {
    settings.volume = clamp(Number(event.target.value) || 0, 0, 100); saveSettings();
    setText('volumeValue', settings.volume + '%'); wakeAudio();
  });
  if ($('shakeToggle')) $('shakeToggle').addEventListener('change', event => { settings.shake = event.target.checked; saveSettings(); });
  if ($('practiceResetButton')) $('practiceResetButton').addEventListener('click', () => {
    if (gameMode !== 'practice') return;
    resetScene(); mode = 'playing'; show('pauseOverlay', false); setText('pauseButton', 'Ⅱ 暂停');
    setText('battleStatus', status()); syncUI(); toast('场地和对手已重置');
  });
  document.querySelectorAll('button[data-mode]').forEach(button => button.addEventListener('click', () => changeMode(button.dataset.mode)));
  document.querySelectorAll('[data-difficulty]').forEach(button => button.addEventListener('click', () => {
    if (!['idle', 'result'].includes(mode) || gameMode !== 'arcade') return;
    difficulty = button.dataset.difficulty; saveSettings(); syncUI(); sound('select');
  }));

  // Initialize the visible interface; game state and simulation remain independent of the animation callback.
  buildRoster('roster', 0); buildRoster('p2Roster', 1);
  selectFighter(selected, 0); selectFighter(selectedP2, 1); syncUI();
  setText('volumeValue', settings.volume + '%');
  requestAnimationFrame(frame);
})();
