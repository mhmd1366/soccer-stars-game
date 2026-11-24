/**
 * js/game.js
 * حلقه اصلی بازی، مدیریت وضعیت‌ها (State Machine)، رندرینگ گرافیکی بالا، VFX و کنترل‌های کشیدن و رها کردن
 */

(function () {
  'use strict';

  const Flags = window.SoccerFlags;
  const Audio = window.SoccerAudio;
  const Physics = window.SoccerPhysics;
  const AI = window.SoccerAI;
  const WORLD = Physics.WORLD;

  const TURN_DURATION = 15.0; // ۱۵ ثانیه برای هر نوبت
  const MAX_DRAG_DIST = 148;
  const CANCEL_DRAG_DIST = 26;

  // وضعیت کلی برنامه و مسابقه
  const state = {
    screen: 'menu', // 'menu' | 'game'
    mode: '1p', // '1p' | '2p'
    difficulty: 'medium', // 'easy' | 'medium' | 'pro'
    winningGoals: 2,
    team1: 'ir',
    team2: 'ar',
    formation1: '1-2-2',
    formation2: '1-2-2',

    // وضعیت مسابقه
    phase: 'AIM', // 'AIM' | 'SIMULATING' | 'GOAL_CELEBRATION' | 'GAME_OVER' | 'PAUSED'
    prevPhase: 'AIM',
    currentTurn: 1, // 1 یا 2
    turnTimeLeft: TURN_DURATION,
    lastTickSecond: 6,
    score1: 0,
    score2: 0,
    goalTimer: 0,
    goalScorer: 0,
    aiThinkTimer: 0,
    aiMovePending: null,

    // اشیای فیزیکی
    pucks: [],
    ball: null,

    // کنترل کشیدن و رها کردن (Slingshot)
    drag: {
      active: false,
      pointerId: null,
      puck: null,
      curX: 0,
      curY: 0,
      power: 0,
      angle: 0,
      cancelled: false
    },

    // افکت‌های بصری (VFX)
    ballTrail: [],
    sparks: [],
    rings: [],
    confetti: [],
    shakeTime: 0,
    shakeMag: 0,
    netRipple: { left: 0, right: 0 },
    pulseTime: 0
  };

  // المان‌های DOM
  const els = {};
  let canvas, ctx;
  let pitchCache = null;
  let scale = 1;
  let dpr = 1;
  let isPortrait = false;
  let rafId = null;
  let lastFrameTime = 0;

  function cacheDOM() {
    els.menuScreen = document.getElementById('menu-screen');
    els.gameScreen = document.getElementById('game-screen');
    els.modeSelector = document.getElementById('mode-selector');
    els.difficultyGroup = document.getElementById('difficulty-group');
    els.difficultySelector = document.getElementById('difficulty-selector');
    els.goalsSelector = document.getElementById('goals-selector');
    els.p1Grid = document.getElementById('p1-countries-grid');
    els.p2Grid = document.getElementById('p2-countries-grid');
    els.p1Preview = document.getElementById('p1-selected-preview');
    els.p2Preview = document.getElementById('p2-selected-preview');
    els.p2ColumnTitle = document.getElementById('p2-column-title');
    els.p1Formation = document.getElementById('p1-formation-selector');
    els.p2Formation = document.getElementById('p2-formation-selector');
    els.startBtn = document.getElementById('start-match-btn');

    els.menuSoundBtn = document.getElementById('menu-sound-btn');
    els.menuHapticsBtn = document.getElementById('menu-haptics-btn');
    els.hudFullscreenBtn = document.getElementById('hud-fullscreen-btn');
    els.hudSoundBtn = document.getElementById('hud-sound-btn');
    els.hudSettingsBtn = document.getElementById('hud-settings-btn');
    els.hudMenuBtn = document.getElementById('hud-menu-btn');

    els.hudTeam1 = document.getElementById('hud-team-1');
    els.hudTeam2 = document.getElementById('hud-team-2');
    els.hudFlag1 = document.getElementById('hud-flag-1');
    els.hudFlag2 = document.getElementById('hud-flag-2');
    els.hudName1 = document.getElementById('hud-name-1');
    els.hudName2 = document.getElementById('hud-name-2');
    els.hudRole1 = document.getElementById('hud-role-1');
    els.hudRole2 = document.getElementById('hud-role-2');
    els.score1 = document.getElementById('score-1');
    els.score2 = document.getElementById('score-2');
    els.targetGoalsBadge = document.getElementById('target-goals-badge');
    els.turnLabel = document.getElementById('turn-label');
    els.timerText = document.getElementById('timer-text');
    els.timerFill = document.getElementById('timer-fill');

    els.stageWrap = document.getElementById('stage-wrap');
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    els.goalBanner = document.getElementById('goal-banner');
    els.goalFlag = document.getElementById('goal-flag');
    els.goalTeamName = document.getElementById('goal-team-name');

    els.settingsModal = document.getElementById('settings-modal');
    els.closeSettingsBtn = document.getElementById('close-settings-btn');
    els.modalSoundToggle = document.getElementById('modal-sound-toggle');
    els.modalHapticsToggle = document.getElementById('modal-haptics-toggle');
    els.modalRestartBtn = document.getElementById('modal-restart-btn');
    els.modalMenuBtn = document.getElementById('modal-menu-btn');

    els.gameoverModal = document.getElementById('gameover-modal');
    els.winnerFlag = document.getElementById('winner-flag');
    els.winnerName = document.getElementById('winner-name');
    els.finalP1Name = document.getElementById('final-p1-name');
    els.finalP2Name = document.getElementById('final-p2-name');
    els.finalScoreText = document.getElementById('final-score-text');
    els.rematchBtn = document.getElementById('rematch-btn');
    els.gameoverMenuBtn = document.getElementById('gameover-menu-btn');
  }

  /* ===================== ساخت منوی انتخاب تیم ===================== */
  function buildTeamGrids() {
    function renderGrid(container, side) {
      container.innerHTML = '';
      Flags.TEAMS.forEach(team => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'country-card';
        btn.dataset.team = team.id;

        const img = document.createElement('img');
        img.src = Flags.getFlagDataURL(team.id, 84, 56);
        img.alt = team.name;

        const span = document.createElement('span');
        span.textContent = team.name;

        btn.appendChild(img);
        btn.appendChild(span);

        btn.addEventListener('click', () => {
          Audio.unlock();
          Audio.playUiClick();
          if (side === 1) {
            state.team1 = team.id;
          } else {
            state.team2 = team.id;
          }
          syncMenuSelections();
        });

        container.appendChild(btn);
      });
    }

    renderGrid(els.p1Grid, 1);
    renderGrid(els.p2Grid, 2);
    syncMenuSelections();
  }

  function syncMenuSelections() {
    els.p1Grid.querySelectorAll('.country-card').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.team === state.team1);
    });
    els.p2Grid.querySelectorAll('.country-card').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.team === state.team2);
    });

    const t1 = Flags.getTeamById(state.team1);
    const t2 = Flags.getTeamById(state.team2);

    els.p1Preview.innerHTML = `<img src="${Flags.getFlagDataURL(t1.id, 48, 32)}" alt="${t1.name}"><span>${t1.name}</span>`;
    els.p2Preview.innerHTML = `<img src="${Flags.getFlagDataURL(t2.id, 48, 32)}" alt="${t2.name}"><span>${t2.name}</span>`;

    els.difficultyGroup.classList.toggle('hidden', state.mode !== '1p');
    els.p2ColumnTitle.textContent = state.mode === '1p' ? 'حریف هوش مصنوعی (راست)' : 'بازیکن ۲ (مهمان راست)';
  }

  function syncAudioUI() {
    const sOn = Audio.isSoundEnabled();
    const hOn = Audio.isHapticsEnabled();
    els.menuSoundBtn.textContent = sOn ? '🔊' : '🔇';
    els.menuSoundBtn.classList.toggle('muted', !sOn);
    els.hudSoundBtn.textContent = sOn ? '🔊' : '🔇';
    els.hudSoundBtn.classList.toggle('muted', !sOn);

    els.menuHapticsBtn.classList.toggle('muted', !hOn);

    els.modalSoundToggle.textContent = sOn ? 'روشن' : 'خاموش';
    els.modalSoundToggle.classList.toggle('on', sOn);

    els.modalHapticsToggle.textContent = hOn ? 'روشن' : 'خاموش';
    els.modalHapticsToggle.classList.toggle('on', hOn);
  }

  function bindMenuEvents() {
    els.modeSelector.addEventListener('click', e => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      Audio.unlock();
      Audio.playUiClick();
      state.mode = btn.dataset.mode;
      els.modeSelector.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
      syncMenuSelections();
    });

    els.difficultySelector.addEventListener('click', e => {
      const btn = e.target.closest('[data-diff]');
      if (!btn) return;
      Audio.unlock();
      Audio.playUiClick();
      state.difficulty = btn.dataset.diff;
      els.difficultySelector.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
    });

    els.goalsSelector.addEventListener('click', e => {
      const btn = e.target.closest('[data-goals]');
      if (!btn) return;
      Audio.unlock();
      Audio.playUiClick();
      state.winningGoals = parseInt(btn.dataset.goals, 10) || 2;
      els.goalsSelector.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
    });

    els.p1Formation.addEventListener('click', e => {
      const btn = e.target.closest('[data-formation]');
      if (!btn) return;
      Audio.unlock();
      Audio.playUiClick();
      state.formation1 = btn.dataset.formation;
      els.p1Formation.querySelectorAll('.form-btn').forEach(b => b.classList.toggle('active', b === btn));
    });

    els.p2Formation.addEventListener('click', e => {
      const btn = e.target.closest('[data-formation]');
      if (!btn) return;
      Audio.unlock();
      Audio.playUiClick();
      state.formation2 = btn.dataset.formation;
      els.p2Formation.querySelectorAll('.form-btn').forEach(b => b.classList.toggle('active', b === btn));
    });

    const toggleSound = () => {
      Audio.setSoundEnabled(!Audio.isSoundEnabled());
      Audio.playUiClick();
      syncAudioUI();
    };

    const toggleHaptics = () => {
      Audio.setHapticsEnabled(!Audio.isHapticsEnabled());
      Audio.playUiClick();
      syncAudioUI();
    };

    els.menuSoundBtn.addEventListener('click', toggleSound);
    els.hudSoundBtn.addEventListener('click', toggleSound);
    els.modalSoundToggle.addEventListener('click', toggleSound);

    els.menuHapticsBtn.addEventListener('click', toggleHaptics);
    els.modalHapticsToggle.addEventListener('click', toggleHaptics);

    els.startBtn.addEventListener('click', () => {
      Audio.unlock();
      Audio.playUiClick();
      startNewMatch();
    });

    if (els.hudFullscreenBtn) {
      els.hudFullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    document.addEventListener('fullscreenchange', () => setTimeout(resizeCanvas, 80));
    els.hudSettingsBtn.addEventListener('click', openSettingsModal);
    els.closeSettingsBtn.addEventListener('click', closeSettingsModal);
    els.hudMenuBtn.addEventListener('click', returnToMenu);
    els.modalMenuBtn.addEventListener('click', returnToMenu);
    els.gameoverMenuBtn.addEventListener('click', returnToMenu);

    els.modalRestartBtn.addEventListener('click', () => {
      closeSettingsModal();
      startNewMatch();
    });

    els.rematchBtn.addEventListener('click', () => {
      els.gameoverModal.classList.remove('open');
      startNewMatch();
    });
  }

  function openSettingsModal() {
    if (state.phase !== 'PAUSED' && state.phase !== 'GAME_OVER') {
      state.prevPhase = state.phase;
      state.phase = 'PAUSED';
    }
    state.drag.active = false;
    els.settingsModal.classList.add('open');
  }

  function closeSettingsModal() {
    els.settingsModal.classList.remove('open');
    if (state.phase === 'PAUSED') {
      state.phase = state.prevPhase;
    }
  }

  function returnToMenu() {
    els.settingsModal.classList.remove('open');
    els.gameoverModal.classList.remove('open');
    els.goalBanner.classList.remove('show');
    state.screen = 'menu';
    state.drag.active = false;
    els.gameScreen.classList.remove('active');
    els.menuScreen.classList.add('active');
  }

  /* ===================== شروع و مدیریت مسابقه ===================== */
  function startNewMatch() {
    state.screen = 'game';
    state.score1 = 0;
    state.score2 = 0;
    state.currentTurn = 1;
    state.ballTrail = [];
    state.sparks = [];
    state.rings = [];
    state.confetti = [];
    state.shakeTime = 0;
    state.netRipple.left = 0;
    state.netRipple.right = 0;

    els.menuScreen.classList.remove('active');
    els.gameScreen.classList.add('active');
    els.gameoverModal.classList.remove('open');
    els.goalBanner.classList.remove('show');

    updateHUDMetadata();
    resetPositionsForKickoff(1);
    tryEnterMobileFullscreen();
    resizeCanvas();
    setTimeout(resizeCanvas, 120);
    Audio.playWhistle('start');
  }

  function resetPositionsForKickoff(kickoffTeam) {
    const entities = Physics.createEntities(state.formation1, state.formation2);
    state.pucks = entities.pucks;
    state.ball = entities.ball;
    state.ballTrail = [];
    state.drag.active = false;
    state.drag.puck = null;
    state.goalScorer = 0;
    state.goalTimer = 0;
    startTurn(kickoffTeam);
  }

  function startTurn(team) {
    state.currentTurn = team;
    state.phase = 'AIM';
    state.turnTimeLeft = TURN_DURATION;
    state.lastTickSecond = 6;
    state.aiMovePending = null;
    state.aiThinkTimer = 0;

    if (state.mode === '1p' && team === 2) {
      // زمان فکر کردن طبیعی هوش مصنوعی
      state.aiThinkTimer = 0.75 + Math.random() * 0.35;
    }

    updateHUDState();
  }

  function updateHUDMetadata() {
    const t1 = Flags.getTeamById(state.team1);
    const t2 = Flags.getTeamById(state.team2);

    els.hudFlag1.src = Flags.getFlagDataURL(t1.id, 88, 60);
    els.hudFlag2.src = Flags.getFlagDataURL(t2.id, 88, 60);
    els.hudName1.textContent = t1.name;
    els.hudName2.textContent = t2.name;

    els.hudRole1.textContent = 'بازیکن ۱';
    const diffNames = { easy: 'آسان', medium: 'متوسط', pro: 'حرفه‌ای' };
    els.hudRole2.textContent = state.mode === '1p' ? `هوش مصنوعی (${diffNames[state.difficulty]})` : 'بازیکن ۲';
    els.targetGoalsBadge.textContent = `تا ${state.winningGoals} گل`;
  }

  function updateHUDState() {
    els.score1.textContent = String(state.score1);
    els.score2.textContent = String(state.score2);

    const t1 = Flags.getTeamById(state.team1);
    const t2 = Flags.getTeamById(state.team2);
    const activeTeam = state.currentTurn === 1 ? t1 : t2;

    els.hudTeam1.classList.toggle('active-turn', state.currentTurn === 1 && state.phase !== 'GAME_OVER');
    els.hudTeam2.classList.toggle('active-turn', state.currentTurn === 2 && state.phase !== 'GAME_OVER');

    if (state.mode === '1p' && state.currentTurn === 2) {
      els.turnLabel.textContent = `نوبت هوش مصنوعی (${activeTeam.name})`;
    } else {
      els.turnLabel.textContent = `نوبت ${activeTeam.name}`;
    }

    updateTimerBar();
  }

  function updateTimerBar() {
    const pct = Math.max(0, Math.min(1, state.turnTimeLeft / TURN_DURATION));
    els.timerFill.style.width = (pct * 100).toFixed(1) + '%';
    els.timerText.textContent = Math.ceil(state.turnTimeLeft) + 's';

    if (pct > 0.5) {
      els.timerFill.style.background = 'linear-gradient(90deg, #22c55e, #4ade80)';
    } else if (pct > 0.25) {
      els.timerFill.style.background = 'linear-gradient(90deg, #eab308, #facc15)';
    } else {
      els.timerFill.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
    }
  }

  function handleGoal(scoringTeam) {
    state.phase = 'GOAL_CELEBRATION';
    state.goalScorer = scoringTeam;
    state.goalTimer = 2.45;
    state.drag.active = false;

    if (scoringTeam === 1) {
      state.score1 += 1;
      state.netRipple.right = 1.0;
    } else {
      state.score2 += 1;
      state.netRipple.left = 1.0;
    }

    updateHUDState();
    triggerScreenShake(11, 0.45);
    spawnGoalConfetti(scoringTeam);
    Audio.playWhistle('goal');
    Audio.playCrowdCheer();

    const scorerInfo = Flags.getTeamById(scoringTeam === 1 ? state.team1 : state.team2);
    els.goalFlag.src = Flags.getFlagDataURL(scorerInfo.id, 96, 64);
    els.goalTeamName.textContent = scorerInfo.name;
    els.goalBanner.classList.add('show');
  }

  function showGameOver(winnerTeam) {
    state.phase = 'GAME_OVER';
    els.goalBanner.classList.remove('show');
    Audio.playWhistle('end');

    const t1 = Flags.getTeamById(state.team1);
    const t2 = Flags.getTeamById(state.team2);
    const winner = winnerTeam === 1 ? t1 : t2;

    els.winnerFlag.src = Flags.getFlagDataURL(winner.id, 112, 76);
    els.winnerName.textContent = winner.name;
    els.finalP1Name.textContent = t1.name;
    els.finalP2Name.textContent = t2.name;
    els.finalScoreText.textContent = `${state.score1} - ${state.score2}`;
    els.gameoverModal.classList.add('open');
  }

  /* ===================== کنترل‌های لمسی و موس ===================== */
  function toggleFullscreen() {
    Audio.unlock();
    Audio.playUiClick();
    try {
      const docEl = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
        if (req) {
          Promise.resolve(req.call(docEl)).catch(() => {});
        }
      } else {
        const ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) {
          Promise.resolve(ex.call(document)).catch(() => {});
        }
      }
    } catch (_) {
      // مرورگر از API تمام‌صفحه پشتیبانی نمی‌کند
    }
  }

  function tryEnterMobileFullscreen() {
    const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (!isTouchDevice) return;
    try {
      const docEl = document.documentElement;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const req = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
        if (req) {
          Promise.resolve(req.call(docEl)).catch(() => {});
        }
      }
    } catch (_) {}
  }

  function clientToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (isPortrait) {
      const sx = ((clientX - rect.left) / rect.width) * WORLD.height;
      const sy = ((clientY - rect.top) / rect.height) * WORLD.width;
      return {
        x: WORLD.width - sy,
        y: sx
      };
    }
    return {
      x: ((clientX - rect.left) / rect.width) * WORLD.width,
      y: ((clientY - rect.top) / rect.height) * WORLD.height
    };
  }

  function canHumanInteract() {
    if (state.screen !== 'game' || state.phase !== 'AIM') return false;
    if (state.mode === '1p' && state.currentTurn === 2) return false;
    return true;
  }

  function bindCanvasControls() {
    canvas.addEventListener('pointerdown', e => {
      Audio.unlock();
      if (!canHumanInteract()) return;

      const pos = clientToWorld(e.clientX, e.clientY);
      let picked = null;
      let bestDist = WORLD.puckRadius * 1.48; // حاشیه لمس راحت برای موبایل

      for (let i = 0; i < state.pucks.length; i++) {
        const p = state.pucks[i];
        if (p.team !== state.currentTurn) continue;
        const d = Math.hypot(pos.x - p.x, pos.y - p.y);
        if (d < bestDist) {
          bestDist = d;
          picked = p;
        }
      }

      if (!picked) return;

      canvas.setPointerCapture(e.pointerId);
      state.drag.active = true;
      state.drag.pointerId = e.pointerId;
      state.drag.puck = picked;
      state.drag.curX = pos.x;
      state.drag.curY = pos.y;
      updateDragVector();
    });

    canvas.addEventListener('pointermove', e => {
      if (!state.drag.active || e.pointerId !== state.drag.pointerId) return;
      const pos = clientToWorld(e.clientX, e.clientY);
      state.drag.curX = pos.x;
      state.drag.curY = pos.y;
      updateDragVector();
    });

    const endDrag = e => {
      if (!state.drag.active || e.pointerId !== state.drag.pointerId) return;
      const d = state.drag;
      d.active = false;
      d.pointerId = null;

      if (!d.cancelled && d.power > 0.04 && d.puck && canHumanInteract()) {
        const speed = d.power * WORLD.maxShotSpeed;
        d.puck.vx = Math.cos(d.angle) * speed;
        d.puck.vy = Math.sin(d.angle) * speed;
        Audio.playPuckHit(0.28 + d.power * 0.45);
        state.phase = 'SIMULATING';
      }
      d.puck = null;
    };

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
  }

  function updateDragVector() {
    const d = state.drag;
    if (!d.puck) return;
    const dx = d.puck.x - d.curX;
    const dy = d.puck.y - d.curY;
    const dist = Math.hypot(dx, dy);

    if (dist < CANCEL_DRAG_DIST) {
      d.cancelled = true;
      d.power = 0;
    } else {
      d.cancelled = false;
      const clamped = Math.min(dist, MAX_DRAG_DIST);
      d.power = (clamped - CANCEL_DRAG_DIST) / (MAX_DRAG_DIST - CANCEL_DRAG_DIST);
      d.angle = Math.atan2(dy, dx);
    }
  }

  /* ===================== سیستم افکت‌های بصری (VFX) ===================== */
  function triggerScreenShake(magnitude, duration) {
    state.shakeMag = Math.max(state.shakeMag, magnitude);
    state.shakeTime = Math.max(state.shakeTime, duration);
  }

  function spawnImpactVFX(x, y, type, intensity) {
    const count = Math.floor(6 + intensity * 12);
    const baseColor =
      type === 'post' ? '#fde047' :
      type === 'ball' ? '#ffffff' : '#93c5fd';

    // موج ضربه دایره‌ای
    state.rings.push({
      x,
      y,
      r: 6,
      maxR: 26 + intensity * 30,
      alpha: 0.75,
      color: baseColor
    });

    // جرقه‌های برخورد
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 90 + Math.random() * 260 * intensity;
      state.sparks.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.25 + Math.random() * 0.28,
        maxLife: 0.53,
        size: 1.8 + Math.random() * 2.6,
        color: i % 2 === 0 ? baseColor : '#f5c542'
      });
    }
  }

  function spawnGoalConfetti(scoringTeam) {
    const team = Flags.getTeamById(scoringTeam === 1 ? state.team1 : state.team2);
    const palette = [team.primary, team.secondary, team.accent, '#f5c542', '#ffffff'];
    const originX = scoringTeam === 1 ? WORLD.fieldRight : WORLD.fieldLeft;
    const originY = WORLD.centerY;

    for (let i = 0; i < 120; i++) {
      const spreadDir = scoringTeam === 1 ? Math.PI : 0;
      const angle = spreadDir + (Math.random() - 0.5) * 2.1;
      const spd = 180 + Math.random() * 540;
      state.confetti.push({
        x: originX + (Math.random() - 0.5) * 40,
        y: originY + (Math.random() - 0.5) * 140,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 120,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 14,
        w: 7 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        color: palette[i % palette.length],
        life: 1.8 + Math.random() * 1.1,
        maxLife: 2.9
      });
    }
  }

  function updateVFX(dt) {
    state.pulseTime += dt;

    // دنباله نورانی پشت توپ در شوت‌های پرقدرت
    if (state.ball) {
      const ballSpd = Math.hypot(state.ball.vx, state.ball.vy);
      if (ballSpd > 340) {
        state.ballTrail.push({
          x: state.ball.x,
          y: state.ball.y,
          r: state.ball.r * 0.92,
          alpha: Math.min(0.85, (ballSpd - 300) / 850),
          hot: ballSpd > 680
        });
      }
    }

    for (let i = state.ballTrail.length - 1; i >= 0; i--) {
      const tr = state.ballTrail[i];
      tr.alpha -= dt * 3.6;
      tr.r *= 0.96;
      if (tr.alpha <= 0.02) state.ballTrail.splice(i, 1);
    }

    for (let i = state.rings.length - 1; i >= 0; i--) {
      const rg = state.rings[i];
      rg.r += (rg.maxR - rg.r) * Math.min(1, dt * 13);
      rg.alpha -= dt * 2.6;
      if (rg.alpha <= 0.02) state.rings.splice(i, 1);
    }

    for (let i = state.sparks.length - 1; i >= 0; i--) {
      const sp = state.sparks[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.vx *= 0.93;
      sp.vy *= 0.93;
      sp.life -= dt;
      if (sp.life <= 0) state.sparks.splice(i, 1);
    }

    for (let i = state.confetti.length - 1; i >= 0; i--) {
      const c = state.confetti[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vy += 320 * dt;
      c.vx *= 0.985;
      c.rot += c.vRot * dt;
      c.life -= dt;
      if (c.life <= 0) state.confetti.splice(i, 1);
    }

    if (state.shakeTime > 0) {
      state.shakeTime = Math.max(0, state.shakeTime - dt);
      if (state.shakeTime === 0) state.shakeMag = 0;
    }

    state.netRipple.left = Math.max(0, state.netRipple.left - dt * 1.4);
    state.netRipple.right = Math.max(0, state.netRipple.right - dt * 1.4);
  }

  /* ===================== به‌روزرسانی منطق بازی ===================== */
  function update(dt) {
    if (state.screen !== 'game' || state.phase === 'PAUSED') return;

    updateVFX(dt);

    if (state.phase === 'AIM') {
      // تایمر ۱۵ ثانیه‌ای نوبت
      state.turnTimeLeft -= dt;
      const ceilSec = Math.ceil(state.turnTimeLeft);
      if (ceilSec <= 5 && ceilSec > 0 && ceilSec < state.lastTickSecond) {
        state.lastTickSecond = ceilSec;
        Audio.playTimerTick();
      }

      if (state.turnTimeLeft <= 0) {
        state.drag.active = false;
        Audio.playTimeout();
        startTurn(state.currentTurn === 1 ? 2 : 1);
        return;
      }

      updateTimerBar();

      // حرکت هوش مصنوعی در حالت تک‌نفره
      if (state.mode === '1p' && state.currentTurn === 2) {
        state.aiThinkTimer -= dt;
        if (state.aiThinkTimer <= 0) {
          const move = AI.computeMove(state.pucks, state.ball, state.difficulty, WORLD);
          if (move && move.puck) {
            move.puck.vx = move.vx;
            move.puck.vy = move.vy;
            const pwr = Math.min(1, Math.hypot(move.vx, move.vy) / WORLD.maxShotSpeed);
            Audio.playPuckHit(0.32 + pwr * 0.45);
            state.phase = 'SIMULATING';
          }
        }
      }
    } else if (state.phase === 'SIMULATING' || state.phase === 'GOAL_CELEBRATION') {
      const result = Physics.step(
        state.pucks,
        state.ball,
        dt,
        state.phase === 'GOAL_CELEBRATION'
      );

      // پخش صدا و افکت برخوردها
      for (let i = 0; i < result.events.length; i++) {
        const ev = result.events[i];
        spawnImpactVFX(ev.x, ev.y, ev.type, ev.intensity);
        if (ev.type === 'ball') {
          Audio.playBallKick(ev.intensity);
          if (ev.intensity > 0.72) triggerScreenShake(3.5, 0.12);
        } else if (ev.type === 'puck') {
          Audio.playPuckHit(ev.intensity);
        } else if (ev.type === 'post') {
          Audio.playPostHit(ev.intensity);
          triggerScreenShake(5, 0.18);
        } else if (ev.type === 'wall') {
          Audio.playWallHit(ev.intensity);
        }
      }

      if (result.goalScoredBy !== 0 && state.phase === 'SIMULATING') {
        handleGoal(result.goalScoredBy);
      }

      if (state.phase === 'SIMULATING' && !result.isMoving) {
        startTurn(state.currentTurn === 1 ? 2 : 1);
      }

      if (state.phase === 'GOAL_CELEBRATION') {
        state.goalTimer -= dt;
        if (state.goalTimer <= 0) {
          els.goalBanner.classList.remove('show');
          if (state.score1 >= state.winningGoals) {
            showGameOver(1);
          } else if (state.score2 >= state.winningGoals) {
            showGameOver(2);
          } else {
            // شروع مجدد توسط تیم گل‌خورده
            const concededTeam = state.goalScorer === 1 ? 2 : 1;
            resetPositionsForKickoff(concededTeam);
            Audio.playWhistle('start');
          }
        }
      }
    }
  }

  /* ===================== رندرینگ باکیفیت زمین و مهره‌ها ===================== */
  function buildPitchCache() {
    const off = document.createElement('canvas');
    off.width = WORLD.width;
    off.height = WORLD.height;
    const c = off.getContext('2d');

    // حاشیه استادیوم اطراف زمین
    const bgGrad = c.createLinearGradient(0, 0, 0, WORLD.height);
    bgGrad.addColorStop(0, '#0b3520');
    bgGrad.addColorStop(0.5, '#072717');
    bgGrad.addColorStop(1, '#041a0f');
    c.fillStyle = bgGrad;
    c.fillRect(0, 0, WORLD.width, WORLD.height);

    // کادر تزئینی اطراف زمین
    c.strokeStyle = 'rgba(245, 197, 66, 0.25)';
    c.lineWidth = 3;
    c.strokeRect(14, 14, WORLD.width - 28, WORLD.height - 28);

    // سایه دور مستطیل چمن
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.55)';
    c.shadowBlur = 24;
    c.fillStyle = '#1b7a3d';
    c.fillRect(WORLD.fieldLeft, WORLD.fieldTop, WORLD.fieldW, WORLD.fieldH);
    c.restore();

    // نوارهای راهراه دو رنگ چمن شاداب
    const stripeCount = 10;
    const stripeW = WORLD.fieldW / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      c.fillStyle = i % 2 === 0 ? '#1f8a44' : '#259d4f';
      c.fillRect(
        WORLD.fieldLeft + i * stripeW,
        WORLD.fieldTop,
        stripeW + 0.6,
        WORLD.fieldH
      );
    }

    // بافت ریز و طبیعی چمن
    c.save();
    c.beginPath();
    c.rect(WORLD.fieldLeft, WORLD.fieldTop, WORLD.fieldW, WORLD.fieldH);
    c.clip();
    for (let i = 0; i < 2400; i++) {
      const gx = WORLD.fieldLeft + Math.random() * WORLD.fieldW;
      const gy = WORLD.fieldTop + Math.random() * WORLD.fieldH;
      c.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.04)';
      c.fillRect(gx, gy, 2, 2);
    }

    // نورپردازی نورافکن‌های استادیوم
    const lightGrad = c.createRadialGradient(
      WORLD.centerX,
      WORLD.centerY,
      80,
      WORLD.centerX,
      WORLD.centerY,
      WORLD.fieldW * 0.65
    );
    lightGrad.addColorStop(0, 'rgba(255, 255, 220, 0.13)');
    lightGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0)');
    lightGrad.addColorStop(1, 'rgba(0, 18, 8, 0.34)');
    c.fillStyle = lightGrad;
    c.fillRect(WORLD.fieldLeft, WORLD.fieldTop, WORLD.fieldW, WORLD.fieldH);
    c.restore();

    // خطوط سفید استاندارد زمین فوتبال
    c.save();
    c.strokeStyle = 'rgba(255, 255, 255, 0.88)';
    c.lineWidth = 3.5;
    c.lineCap = 'round';
    c.lineJoin = 'round';

    // کادر بیرونی زمین
    c.strokeRect(WORLD.fieldLeft, WORLD.fieldTop, WORLD.fieldW, WORLD.fieldH);

    // خط میانه زمین
    c.beginPath();
    c.moveTo(WORLD.centerX, WORLD.fieldTop);
    c.lineTo(WORLD.centerX, WORLD.fieldBottom);
    c.stroke();

    // دایره میانی و نقطه شروع
    c.beginPath();
    c.arc(WORLD.centerX, WORLD.centerY, 82, 0, Math.PI * 2);
    c.stroke();

    c.fillStyle = 'rgba(255, 255, 255, 0.92)';
    c.beginPath();
    c.arc(WORLD.centerX, WORLD.centerY, 6, 0, Math.PI * 2);
    c.fill();

    // محوطه جریمه و شش‌قدم چپ و راست
    const penW = 148;
    const penH = 310;
    const sixW = 54;
    const sixH = 196;

    // چپ
    c.strokeRect(WORLD.fieldLeft, WORLD.centerY - penH / 2, penW, penH);
    c.strokeRect(WORLD.fieldLeft, WORLD.centerY - sixH / 2, sixW, sixH);
    c.beginPath();
    c.arc(WORLD.fieldLeft + 104, WORLD.centerY, 4.5, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(WORLD.fieldLeft + 104, WORLD.centerY, 68, -0.78, 0.78);
    c.stroke();

    // راست
    c.strokeRect(WORLD.fieldRight - penW, WORLD.centerY - penH / 2, penW, penH);
    c.strokeRect(WORLD.fieldRight - sixW, WORLD.centerY - sixH / 2, sixW, sixH);
    c.beginPath();
    c.arc(WORLD.fieldRight - 104, WORLD.centerY, 4.5, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(WORLD.fieldRight - 104, WORLD.centerY, 68, Math.PI - 0.78, Math.PI + 0.78);
    c.stroke();

    // قوس‌های کرنر
    const cr = 22;
    c.beginPath(); c.arc(WORLD.fieldLeft, WORLD.fieldTop, cr, 0, Math.PI / 2); c.stroke();
    c.beginPath(); c.arc(WORLD.fieldRight, WORLD.fieldTop, cr, Math.PI / 2, Math.PI); c.stroke();
    c.beginPath(); c.arc(WORLD.fieldRight, WORLD.fieldBottom, cr, Math.PI, Math.PI * 1.5); c.stroke();
    c.beginPath(); c.arc(WORLD.fieldLeft, WORLD.fieldBottom, cr, Math.PI * 1.5, Math.PI * 2); c.stroke();

    c.restore();
    pitchCache = off;
  }

  function drawGoalNet(side) {
    const isLeft = side === 'left';
    const ripple = isLeft ? state.netRipple.left : state.netRipple.right;
    const gx = isLeft ? WORLD.fieldLeft - WORLD.goalWidth : WORLD.fieldRight;
    const gy = WORLD.goalTop;
    const gw = WORLD.goalWidth;
    const gh = WORLD.goalHeight;
    const wobble = ripple > 0 ? Math.sin(state.pulseTime * 32) * 5 * ripple : 0;

    ctx.save();

    // عمق تیره داخل دروازه
    const depthGrad = ctx.createLinearGradient(
      isLeft ? gx : gx + gw,
      gy,
      isLeft ? gx + gw : gx,
      gy
    );
    depthGrad.addColorStop(0, 'rgba(2, 12, 8, 0.78)');
    depthGrad.addColorStop(1, 'rgba(6, 36, 22, 0.35)');
    ctx.fillStyle = depthGrad;
    ctx.fillRect(gx, gy, gw, gh);

    // بافت تور مشبک سه‌بعدی
    ctx.beginPath();
    ctx.rect(gx - 2, gy, gw + 4, gh);
    ctx.clip();

    ctx.strokeStyle = 'rgba(240, 248, 255, 0.36)';
    ctx.lineWidth = 1.3;
    const cell = 13;

    // خطوط عمودی با موج خفیف هنگام گل
    for (let x = gx; x <= gx + gw; x += cell) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.quadraticCurveTo(x + wobble, gy + gh / 2, x, gy + gh);
      ctx.stroke();
    }
    // خطوط افقی
    for (let y = gy; y <= gy + gh; y += cell) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.quadraticCurveTo(gx + gw / 2, y + wobble * 0.5, gx + gw, y);
      ctx.stroke();
    }

    // قاب پشتی و کناری دروازه
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (isLeft) {
      ctx.moveTo(WORLD.fieldLeft, gy);
      ctx.lineTo(gx, gy + 5);
      ctx.lineTo(gx, gy + gh - 5);
      ctx.lineTo(WORLD.fieldLeft, gy + gh);
    } else {
      ctx.moveTo(WORLD.fieldRight, gy);
      ctx.lineTo(gx + gw, gy + 5);
      ctx.lineTo(gx + gw, gy + gh - 5);
      ctx.lineTo(WORLD.fieldRight, gy + gh);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawGoalPosts() {
    Physics.GOAL_POSTS.forEach(post => {
      ctx.save();
      // سایه تیرک
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.arc(post.x + 3, post.y + 4, post.r + 1, 0, Math.PI * 2);
      ctx.fill();

      // بدنه فلزی سه‌بعدی تیرک
      const g = ctx.createRadialGradient(
        post.x - post.r * 0.35,
        post.y - post.r * 0.35,
        1,
        post.x,
        post.y,
        post.r
      );
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.45, '#e2e8f0');
      g.addColorStop(0.85, '#94a3b8');
      g.addColorStop(1, '#475569');

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(post.x, post.y, post.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    });
  }

  /**
   * رسم مهره سه‌بعدی با حاشیه فلزی طلایی براق، پرچم برداری و بازتاب شیشه‌ای
   */
  function drawPuck(puck) {
    const teamId = puck.team === 1 ? state.team1 : state.team2;
    const r = puck.r;
    const isMyTurn =
      state.phase === 'AIM' &&
      puck.team === state.currentTurn &&
      !(state.mode === '1p' && state.currentTurn === 2);

    ctx.save();

    // هاله نوبتی زیر مهره‌های بازیکن فعال
    if (isMyTurn) {
      const pulse = 0.5 + 0.5 * Math.sin(state.pulseTime * 5.2);
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, r + 4.5 + pulse * 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(250, 204, 21, ${0.38 + pulse * 0.42})`;
      ctx.lineWidth = 2.6;
      ctx.stroke();
    }

    // سایه نرم روی چمن
    ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
    ctx.beginPath();
    ctx.ellipse(puck.x + 3.5, puck.y + 6.5, r * 1.02, r * 0.94, 0, 0, Math.PI * 2);
    ctx.fill();

    // حاشیه فلزی طلایی براق (Golden Metallic Rim)
    const rimGrad = ctx.createLinearGradient(puck.x - r, puck.y - r, puck.x + r, puck.y + r);
    rimGrad.addColorStop(0, '#fff7cc');
    rimGrad.addColorStop(0.25, '#f5c542');
    rimGrad.addColorStop(0.55, '#b87908');
    rimGrad.addColorStop(0.8, '#f8d568');
    rimGrad.addColorStop(1, '#784802');

    ctx.beginPath();
    ctx.arc(puck.x, puck.y, r, 0, Math.PI * 2);
    ctx.fillStyle = rimGrad;
    ctx.fill();

    // شیار داخلی لبه طلایی
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, r - 1.2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 250, 220, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // پرچم دایره‌ای کشور داخل مهره
    const innerR = r - 4.8;
    const flagCanvas = Flags.getCircleFlagCanvas(teamId, innerR * 2);
    ctx.drawImage(flagCanvas, puck.x - innerR, puck.y - innerR, innerR * 2, innerR * 2);

    // سایه داخلی لبه پرچم برای عمق سه‌بعدی
    const innerShadow = ctx.createRadialGradient(
      puck.x,
      puck.y,
      innerR * 0.65,
      puck.x,
      puck.y,
      innerR
    );
    innerShadow.addColorStop(0, 'rgba(0,0,0,0)');
    innerShadow.addColorStop(1, 'rgba(0,0,0,0.34)');
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, innerR, 0, Math.PI * 2);
    ctx.fillStyle = innerShadow;
    ctx.fill();

    // درخشش شیشه‌ای گنبدی روی مهره (3D Glossy Specular)
    const gloss = ctx.createLinearGradient(
      puck.x - innerR * 0.7,
      puck.y - innerR * 0.9,
      puck.x + innerR * 0.2,
      puck.y + innerR * 0.3
    );
    gloss.addColorStop(0, 'rgba(255, 255, 255, 0.52)');
    gloss.addColorStop(0.45, 'rgba(255, 255, 255, 0.12)');
    gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.ellipse(puck.x - innerR * 0.14, puck.y - innerR * 0.36, innerR * 0.68, innerR * 0.42, -0.35, 0, Math.PI * 2);
    ctx.fillStyle = gloss;
    ctx.fill();

    // خط دور بیرونی ظریف برای تفکیک روی چمن
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(40, 22, 0, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * رسم توپ فوتبال سه‌بعدی با پنل‌های چرخان و دنباله نورانی
   */
  function drawBallAndTrail() {
    // ۱. دنباله نورانی (Glowing Trail)
    for (let i = 0; i < state.ballTrail.length; i++) {
      const tr = state.ballTrail[i];
      ctx.save();
      const g = ctx.createRadialGradient(tr.x, tr.y, 1, tr.x, tr.y, tr.r * 1.45);
      if (tr.hot) {
        g.addColorStop(0, `rgba(255, 244, 180, ${tr.alpha * 0.85})`);
        g.addColorStop(0.5, `rgba(245, 158, 11, ${tr.alpha * 0.45})`);
        g.addColorStop(1, 'rgba(245, 158, 11, 0)');
      } else {
        g.addColorStop(0, `rgba(255, 255, 255, ${tr.alpha * 0.65})`);
        g.addColorStop(0.6, `rgba(125, 211, 252, ${tr.alpha * 0.25})`);
        g.addColorStop(1, 'rgba(125, 211, 252, 0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, tr.r * 1.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const b = state.ball;
    if (!b) return;
    const r = b.r;

    ctx.save();
    // سایه توپ روی چمن
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(b.x + 3, b.y + 5.5, r * 0.98, r * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    // کره پایه توپ
    const ballGrad = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.35, 1.5, b.x, b.y, r);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.7, '#e2e8f0');
    ballGrad.addColorStop(1, '#94a3b8');

    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // پنج‌ضلعی‌های کلاسیک توپ فوتبال (چرخان با حرکت توپ)
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, b.y, r - 0.5, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);

    ctx.fillStyle = '#1e293b';
    // پنج‌ضلعی مرکزی
    drawPolygon(ctx, 0, 0, r * 0.36, 5);
    ctx.fill();

    // ۵ پنل پیرامونی
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const px = Math.cos(a) * r * 0.88;
      const py = Math.sin(a) * r * 0.88;
      drawPolygon(ctx, px, py, r * 0.34, 5);
      ctx.fill();

      ctx.strokeStyle = 'rgba(51, 65, 85, 0.55)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.33, Math.sin(a) * r * 0.33);
      ctx.lineTo(px, py);
      ctx.stroke();
    }
    ctx.restore();

    // نقطه درخشش روی توپ
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.ellipse(b.x - r * 0.3, b.y - r * 0.34, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawPolygon(context, cx, cy, radius, sides) {
    context.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i * Math.PI * 2) / sides - Math.PI / 2;
      const x = cx + Math.cos(a) * radius;
      const y = cy + Math.sin(a) * radius;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
  }

  /**
   * رنگ حلقه قدرت: سبز -> زرد -> قرمز
   */
  function getPowerColor(power) {
    if (power < 0.5) {
      const t = power / 0.5;
      const r = Math.round(34 + (234 - 34) * t);
      const g = Math.round(197 + (179 - 197) * t);
      const b = Math.round(94 + (8 - 94) * t);
      return `rgb(${r}, ${g}, ${b})`;
    }
    const t = (power - 0.5) / 0.5;
    const r = Math.round(234 + (239 - 234) * t);
    const g = Math.round(179 + (68 - 179) * t);
    const b = Math.round(8 + (68 - 8) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * رسم حلقه قدرت (Power Ring) و خط راهنمای جهت شوت
   */
  function drawAimingOverlay() {
    const d = state.drag;
    if (!d.active || !d.puck) return;

    const p = d.puck;
    ctx.save();

    if (d.cancelled) {
      // حالت لغو شوت
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 11, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.65)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.save();
      ctx.font = '700 13px Vazirmatn, Tahoma, sans-serif';
      ctx.fillStyle = 'rgba(241, 245, 249, 0.95)';
      ctx.textAlign = 'center';
      if (isPortrait) {
        ctx.translate(p.x + p.r + 22, p.y);
        ctx.rotate(Math.PI / 2);
        ctx.fillText('لغو شوت', 0, 0);
      } else {
        ctx.fillText('لغو شوت', p.x, p.y - p.r - 18);
      }
      ctx.restore();
      ctx.restore();
      return;
    }

    const powerColor = getPowerColor(d.power);
    const ringRadius = p.r + 10 + d.power * 26;

    // هاله نرم حلقه قدرت
    const ringGrad = ctx.createRadialGradient(p.x, p.y, p.r, p.x, p.y, ringRadius + 10);
    ringGrad.addColorStop(0, 'rgba(255,255,255,0)');
    ringGrad.addColorStop(0.75, powerColor.replace('rgb', 'rgba').replace(')', ', 0.25)'));
    ringGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, ringRadius + 10, 0, Math.PI * 2);
    ctx.fill();

    // حلقه قدرت اصلی
    ctx.beginPath();
    ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = powerColor;
    ctx.lineWidth = 4.2;
    ctx.stroke();

    // خط کشش تیرکمان به سمت عقب
    const pullLen = CANCEL_DRAG_DIST + d.power * (MAX_DRAG_DIST - CANCEL_DRAG_DIST);
    const backX = p.x - Math.cos(d.angle) * pullLen;
    const backY = p.y - Math.sin(d.angle) * pullLen;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(backX, backY);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(backX, backY, 7, 0, Math.PI * 2);
    ctx.fillStyle = powerColor;
    ctx.fill();

    // خط راهنمای جهت شوت به سمت جلو
    const guideLen = 65 + d.power * 210;
    const tipX = p.x + Math.cos(d.angle) * guideLen;
    const tipY = p.y + Math.sin(d.angle) * guideLen;

    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(d.angle) * (p.r + 6), p.y + Math.sin(d.angle) * (p.r + 6));
    ctx.lineTo(tipX, tipY);
    ctx.strokeStyle = powerColor;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.setLineDash([12, 9]);
    ctx.stroke();
    ctx.setLineDash([]);

    // سرپیکان جهت شوت
    const headLen = 16;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(
      tipX - headLen * Math.cos(d.angle - 0.45),
      tipY - headLen * Math.sin(d.angle - 0.45)
    );
    ctx.lineTo(
      tipX - headLen * Math.cos(d.angle + 0.45),
      tipY - headLen * Math.sin(d.angle + 0.45)
    );
    ctx.closePath();
    ctx.fillStyle = powerColor;
    ctx.fill();

    ctx.restore();
  }

  function drawVFX() {
    // امواج ضربه
    for (let i = 0; i < state.rings.length; i++) {
      const rg = state.rings[i];
      ctx.save();
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
      ctx.strokeStyle = rg.color;
      ctx.globalAlpha = Math.max(0, rg.alpha);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // جرقه‌ها
    for (let i = 0; i < state.sparks.length; i++) {
      const sp = state.sparks[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, sp.life / sp.maxLife);
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // کونفتی گل
    for (let i = 0; i < state.confetti.length; i++) {
      const c = state.confetti[i];
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, c.life / 0.6));
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
  }

  function render() {
    if (state.screen !== 'game' || !pitchCache) return;

    ctx.save();
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    if (isPortrait) {
      ctx.translate(0, WORLD.width);
      ctx.rotate(-Math.PI / 2);
    }

    // لرزش ملایم دوربین هنگام گل و ضربات سنگین
    if (state.shakeTime > 0) {
      const factor = state.shakeTime * 2.2;
      const sx = (Math.random() - 0.5) * state.shakeMag * Math.min(1, factor);
      const sy = (Math.random() - 0.5) * state.shakeMag * Math.min(1, factor);
      ctx.translate(sx, sy);
    }

    // ۱. چمن و خطوط زمین (کش‌شده)
    ctx.drawImage(pitchCache, 0, 0);

    // ۲. راهنمای هدف‌گیری زیر مهره‌ها
    drawAimingOverlay();

    // ۳. مهره‌های هر دو تیم
    for (let i = 0; i < state.pucks.length; i++) {
      drawPuck(state.pucks[i]);
    }

    // ۴. دنباله نورانی و توپ
    drawBallAndTrail();

    // ۵. تور دروازه‌ها و ۴ تیرک سه‌بعدی روی لایه بالایی
    drawGoalNet('left');
    drawGoalNet('right');
    drawGoalPosts();

    // ۶. افکت‌های ذرات (جرقه، موج ضربه و کونفتی)
    drawVFX();

    ctx.restore();
  }

  /* ===================== تنظیم اندازه واکنش‌گرا ===================== */
  function resizeCanvas() {
    if (!els.stageWrap || state.screen !== 'game') return;
    const availW = Math.max(220, els.stageWrap.clientWidth - 2);
    const availH = Math.max(220, els.stageWrap.clientHeight - 2);

    // در صفحه عمودی موبایل زمین به‌صورت خودکار ۹۰ درجه می‌چرخد تا تمام صفحه را پر کند
    isPortrait = availH > availW * 1.08;

    const logicalW = isPortrait ? WORLD.height : WORLD.width;
    const logicalH = isPortrait ? WORLD.width : WORLD.height;
    const aspect = logicalW / logicalH;

    let cssW = availW;
    let cssH = cssW / aspect;

    if (cssH > availH) {
      cssH = availH;
      cssW = cssH * aspect;
    }

    dpr = Math.min(window.devicePixelRatio || 1, 2);
    scale = cssW / logicalW;

    canvas.style.width = Math.floor(cssW) + 'px';
    canvas.style.height = Math.floor(cssH) + 'px';
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);

    render();
  }

  /* ===================== حلقه اصلی با نرخ فریم پایدار ===================== */
  function loop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const dt = Math.min(0.05, (timestamp - lastFrameTime) / 1000);
    lastFrameTime = timestamp;

    update(dt);
    render();

    rafId = requestAnimationFrame(loop);
  }

  function init() {
    cacheDOM();
    buildPitchCache();
    buildTeamGrids();
    bindMenuEvents();
    bindCanvasControls();
    syncAudioUI();

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 120));

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener('load', init);
})();
