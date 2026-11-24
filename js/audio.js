/**
 * js/audio.js
 * موتور تولید صدای رویه‌ای با Web Audio API و بازخورد لرزشی (Vibration API) بدون فایل صوتی خارجی
 */

window.SoccerAudio = (function () {
  'use strict';

  let ctx = null;
  let noiseBuffer = null;
  let soundEnabled = true;
  let hapticsEnabled = true;

  function ensureContext() {
    if (!soundEnabled) return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
      noiseBuffer = createNoiseBuffer(ctx, 2.5);
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function unlock() {
    ensureContext();
  }

  function createNoiseBuffer(audioCtx, duration) {
    const sampleRate = audioCtx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = audioCtx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.2965164;
      b2 = 0.57000 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
    }
    return buffer;
  }

  function vibrate(pattern) {
    if (!hapticsEnabled) return;
    try {
      if (navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch (_) {
      // مرورگر از لرزش پشتیبانی نمی‌کند
    }
  }

  /**
   * برخورد مهره به مهره (صدای کریستالی/اکریلیک تمیز)
   */
  function playPuckHit(intensity = 0.6) {
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const vol = Math.min(1, Math.max(0.08, intensity));

    // بدنه تیز برخورد
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520 + vol * 260, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.065);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol * 0.36, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.08);

    // کلیک لحظه‌ای برخورد
    if (noiseBuffer) {
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.Q.setValueAtTime(2.5, now);

      const nGain = ac.createGain();
      nGain.gain.setValueAtTime(vol * 0.28, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(ac.destination);
      src.start(now);
      src.stop(now + 0.035);
    }

    if (vol > 0.68) vibrate(12);
  }

  /**
   * برخورد مهره با توپ (ضربه توپ فوتبال پرقدرت)
   */
  function playBallKick(intensity = 0.7) {
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const vol = Math.min(1, Math.max(0.1, intensity));

    // بیس ضربه چرمی توپ
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(195 + vol * 90, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.11);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol * 0.55, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.13);

    // صدای تماس تیز
    if (noiseBuffer) {
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = ac.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(900, now);

      const nGain = ac.createGain();
      nGain.gain.setValueAtTime(vol * 0.22, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(ac.destination);
      src.start(now);
      src.stop(now + 0.045);
    }

    if (vol > 0.6) vibrate(16);
  }

  /**
   * برخورد به تیرک فلزی دروازه (زنگ فلزی واقعی)
   */
  function playPostHit(intensity = 0.8) {
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const vol = Math.min(1, Math.max(0.2, intensity));

    const freqs = [880, 1465, 2310];
    freqs.forEach((f, idx) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, now);

      const peak = (vol * 0.28) / (idx + 1);
      const dur = 0.28 - idx * 0.05;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);

      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    });

    vibrate([18, 25, 12]);
  }

  /**
   * برخورد به دیواره نرم زمین
   */
  function playWallHit(intensity = 0.4) {
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const vol = Math.min(1, Math.max(0.06, intensity));

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140 + vol * 50, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.07);

    gain.gain.setValueAtTime(vol * 0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * سوت داور (شروع، گل، پایان بازی)
   */
  function playWhistle(type = 'start') {
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;

    function blow(startOffset, duration, baseFreq = 2780) {
      const t0 = now + startOffset;
      const osc = ac.createOscillator();
      const lfo = ac.createOscillator();
      const lfoGain = ac.createGain();
      const gain = ac.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, t0);
      osc.frequency.linearRampToValueAtTime(baseFreq + 110, t0 + duration * 0.3);
      osc.frequency.linearRampToValueAtTime(baseFreq - 60, t0 + duration);

      // لرزش ساچمه داخل سوت داور
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(34, t0);
      lfoGain.gain.setValueAtTime(85, t0);

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.22, t0 + 0.025);
      gain.gain.setValueAtTime(0.2, t0 + duration - 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start(t0);
      lfo.start(t0);
      osc.stop(t0 + duration + 0.02);
      lfo.stop(t0 + duration + 0.02);
    }

    if (type === 'start') {
      blow(0, 0.32, 2820);
    } else if (type === 'goal') {
      blow(0, 0.18, 2850);
      blow(0.22, 0.42, 2900);
    } else if (type === 'end') {
      blow(0, 0.16, 2820);
      blow(0.22, 0.16, 2820);
      blow(0.46, 0.52, 2760);
    }
  }

  /**
   * تشویق تماشاگران و آکورد جشن هنگام گل
   */
  function playCrowdCheer() {
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;

    // غرش تماشاگران استادیوم
    if (noiseBuffer) {
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer;

      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(650, now);
      filter.frequency.linearRampToValueAtTime(1250, now + 0.45);
      filter.frequency.linearRampToValueAtTime(800, now + 2.1);
      filter.Q.setValueAtTime(0.85, now);

      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.55, now + 0.25);
      gain.gain.setValueAtTime(0.45, now + 1.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.25);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ac.destination);
      src.start(now);
      src.stop(now + 2.3);
    }

    // فانفار شاد پیروزی
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const t0 = now + i * 0.075;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0);

      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.14, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);

      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + 0.58);
    });

    vibrate([35, 45, 55]);
  }

  function playTimerTick() {
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, now);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  function playTimeout() {
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.linearRampToValueAtTime(160, now + 0.25);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  function playUiClick() {
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.035);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  function setSoundEnabled(val) {
    soundEnabled = Boolean(val);
    if (soundEnabled) unlock();
  }

  function isSoundEnabled() {
    return soundEnabled;
  }

  function setHapticsEnabled(val) {
    hapticsEnabled = Boolean(val);
  }

  function isHapticsEnabled() {
    return hapticsEnabled;
  }

  return {
    unlock,
    playPuckHit,
    playBallKick,
    playPostHit,
    playWallHit,
    playWhistle,
    playCrowdCheer,
    playTimerTick,
    playTimeout,
    playUiClick,
    setSoundEnabled,
    isSoundEnabled,
    setHapticsEnabled,
    isHapticsEnabled
  };
})();
