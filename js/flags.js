/**
 * js/flags.js
 * رسم برداری و باکیفیت پرچم ۱۲ کشور روی HTML5 Canvas بدون هیچ فایل تصویری خارجی
 */

window.SoccerFlags = (function () {
  'use strict';

  const TEAMS = [
    { id: 'ir', name: 'ایران', primary: '#239F40', secondary: '#DA0000', accent: '#FFFFFF' },
    { id: 'ar', name: 'آرژانتین', primary: '#74ACDF', secondary: '#FFFFFF', accent: '#F6B40E' },
    { id: 'fr', name: 'فرانسه', primary: '#002395', secondary: '#ED2939', accent: '#FFFFFF' },
    { id: 'br', name: 'برزیل', primary: '#009C3B', secondary: '#FFDF00', accent: '#002776' },
    { id: 'de', name: 'آلمان', primary: '#DD0000', secondary: '#FFCE00', accent: '#111111' },
    { id: 'es', name: 'اسپانیا', primary: '#AA151B', secondary: '#F1BF00', accent: '#AA151B' },
    { id: 'pt', name: 'پرتغال', primary: '#006600', secondary: '#FF0000', accent: '#FFCC00' },
    { id: 'en', name: 'انگلیس', primary: '#FFFFFF', secondary: '#CF142B', accent: '#CF142B' },
    { id: 'it', name: 'ایتالیا', primary: '#009246', secondary: '#CE2B37', accent: '#FFFFFF' },
    { id: 'nl', name: 'هلند', primary: '#AE1C28', secondary: '#21468B', accent: '#FFFFFF' },
    { id: 'hr', name: 'کرواسی', primary: '#FF0000', secondary: '#171796', accent: '#FFFFFF' },
    { id: 'ma', name: 'مراکش', primary: '#C1272D', secondary: '#006233', accent: '#FFFFFF' }
  ];

  const flagCache = new Map();

  function getTeamById(id) {
    return TEAMS.find(t => t.id === id) || TEAMS[0];
  }

  function drawStar(ctx, cx, cy, spikes, outerR, innerR) {
    let rot = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerR);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
      rot += step;
    }
    ctx.closePath();
  }

  function drawPentagramOutline(ctx, cx, cy, radius, lineWidth, color) {
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      pts.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
    }
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    const order = [0, 2, 4, 1, 3, 0];
    ctx.moveTo(pts[order[0]].x, pts[order[0]].y);
    for (let i = 1; i < order.length; i++) {
      ctx.lineTo(pts[order[i]].x, pts[order[i]].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * رسم پرچم در مستطیل (x, y, w, h)
   */
  function drawFlagRect(ctx, id, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    switch (id) {
      case 'ir': {
        const s = h / 3;
        ctx.fillStyle = '#239F40';
        ctx.fillRect(x, y, w, s + 0.5);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y + s, w, s + 0.5);
        ctx.fillStyle = '#DA0000';
        ctx.fillRect(x, y + 2 * s, w, s + 1);

        // خط تزئینی کوفی الله اکبر روی لبه سبز و قرمز
        ctx.fillStyle = '#FFFFFF';
        const step = w / 11;
        const barH = Math.max(1.2, h * 0.032);
        for (let i = 0; i < 11; i++) {
          ctx.fillRect(x + i * step + step * 0.15, y + s - barH * 1.3, step * 0.7, barH);
          ctx.fillRect(x + i * step + step * 0.15, y + 2 * s + barH * 0.3, step * 0.7, barH);
        }

        // نشان رسمی ایران (فرم برداری دقیق)
        const cx = x + w / 2;
        const cy = y + h / 2;
        const r = h * 0.125;
        ctx.strokeStyle = '#DA0000';
        ctx.fillStyle = '#DA0000';
        ctx.lineWidth = Math.max(1.4, r * 0.24);
        ctx.lineCap = 'round';

        // تیغه مرکزی
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 0.95);
        ctx.lineTo(cx, cy + r * 0.95);
        ctx.stroke();

        // چهار هلال متقارن
        ctx.beginPath();
        ctx.arc(cx - r * 0.26, cy, r * 0.66, -Math.PI * 0.62, Math.PI * 0.52);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx + r * 0.26, cy, r * 0.66, Math.PI * 0.48, Math.PI * 1.62);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx - r * 0.52, cy, r * 0.85, -Math.PI * 0.42, Math.PI * 0.42);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx + r * 0.52, cy, r * 0.85, Math.PI * 0.58, Math.PI * 1.42);
        ctx.stroke();

        // تشدید بالا
        ctx.beginPath();
        ctx.arc(cx, cy - r * 1.02, r * 0.24, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
        break;
      }

      case 'ar': {
        const s = h / 3;
        ctx.fillStyle = '#74ACDF';
        ctx.fillRect(x, y, w, s + 0.5);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y + s, w, s + 0.5);
        ctx.fillStyle = '#74ACDF';
        ctx.fillRect(x, y + 2 * s, w, s + 1);

        // خورشید می
        const cx = x + w / 2;
        const cy = y + h / 2;
        const r = h * 0.115;
        ctx.fillStyle = '#F6B40E';
        ctx.strokeStyle = '#855A00';
        ctx.lineWidth = Math.max(0.7, r * 0.1);
        drawStar(ctx, cx, cy, 12, r * 1.35, r * 0.68);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = '#F6B40E';
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 'fr': {
        const s = w / 3;
        ctx.fillStyle = '#002395';
        ctx.fillRect(x, y, s + 0.5, h);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x + s, y, s + 0.5, h);
        ctx.fillStyle = '#ED2939';
        ctx.fillRect(x + 2 * s, y, s + 1, h);
        break;
      }

      case 'br': {
        ctx.fillStyle = '#009C3B';
        ctx.fillRect(x, y, w, h);

        const cx = x + w / 2;
        const cy = y + h / 2;
        ctx.fillStyle = '#FFDF00';
        ctx.beginPath();
        ctx.moveTo(cx, y + h * 0.14);
        ctx.lineTo(x + w * 0.86, cy);
        ctx.lineTo(cx, y + h * 0.86);
        ctx.lineTo(x + w * 0.14, cy);
        ctx.closePath();
        ctx.fill();

        const r = h * 0.22;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#002776';
        ctx.fill();
        ctx.clip();

        // نوار سفید انحنادار
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = r * 0.24;
        ctx.beginPath();
        ctx.arc(cx - r * 0.2, cy + r * 1.25, r * 1.4, -Math.PI * 0.72, -Math.PI * 0.15);
        ctx.stroke();

        // ستارگان کوچک سفید
        ctx.fillStyle = '#FFFFFF';
        const stars = [
          [-0.3, 0.25], [0.1, 0.35], [0.35, 0.15],
          [-0.05, 0.1], [0.22, -0.25], [-0.45, 0.05]
        ];
        stars.forEach(([sx, sy]) => {
          ctx.beginPath();
          ctx.arc(cx + sx * r, cy + sy * r, Math.max(0.8, r * 0.08), 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
        break;
      }

      case 'de': {
        const s = h / 3;
        ctx.fillStyle = '#111111';
        ctx.fillRect(x, y, w, s + 0.5);
        ctx.fillStyle = '#DD0000';
        ctx.fillRect(x, y + s, w, s + 0.5);
        ctx.fillStyle = '#FFCE00';
        ctx.fillRect(x, y + 2 * s, w, s + 1);
        break;
      }

      case 'es': {
        ctx.fillStyle = '#AA151B';
        ctx.fillRect(x, y, w, h * 0.25 + 0.5);
        ctx.fillStyle = '#F1BF00';
        ctx.fillRect(x, y + h * 0.25, w, h * 0.5 + 0.5);
        ctx.fillStyle = '#AA151B';
        ctx.fillRect(x, y + h * 0.75, w, h * 0.25 + 1);

        // نشان سلطنتی اسپانیا
        const cx = x + w * 0.36;
        const cy = y + h * 0.5;
        const sw = w * 0.13;
        const sh = h * 0.24;
        ctx.fillStyle = '#AA151B';
        ctx.fillRect(cx - sw * 0.5, cy - sh * 0.35, sw, sh * 0.85);
        ctx.fillStyle = '#F1BF00';
        ctx.fillRect(cx - sw * 0.25, cy - sh * 0.2, sw * 0.5, sh * 0.55);
        ctx.fillStyle = '#C99700';
        ctx.beginPath();
        ctx.arc(cx, cy - sh * 0.48, sw * 0.42, Math.PI, 0);
        ctx.fill();
        // ستون‌های هرکول
        ctx.fillStyle = '#E5E7EB';
        ctx.fillRect(cx - sw * 0.76, cy - sh * 0.35, sw * 0.16, sh * 0.85);
        ctx.fillRect(cx + sw * 0.60, cy - sh * 0.35, sw * 0.16, sh * 0.85);
        break;
      }

      case 'pt': {
        const split = x + w * 0.4;
        ctx.fillStyle = '#006600';
        ctx.fillRect(x, y, w * 0.4 + 0.5, h);
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(split, y, w * 0.6 + 1, h);

        const cy = y + h / 2;
        const r = h * 0.19;
        // کره اسطرلابی طلایی
        ctx.strokeStyle = '#FFCC00';
        ctx.lineWidth = Math.max(1.4, r * 0.18);
        ctx.beginPath();
        ctx.arc(split, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(split - r, cy);
        ctx.lineTo(split + r, cy);
        ctx.moveTo(split, cy - r);
        ctx.lineTo(split, cy + r);
        ctx.stroke();

        // سپر قرمز و سفید
        ctx.fillStyle = '#D91E18';
        ctx.fillRect(split - r * 0.48, cy - r * 0.52, r * 0.96, r * 1.04);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(split - r * 0.28, cy - r * 0.32, r * 0.56, r * 0.64);
        ctx.fillStyle = '#003399';
        ctx.beginPath();
        ctx.arc(split, cy, r * 0.12, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'en': {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y, w, h);
        const cross = Math.min(w, h) * 0.2;
        ctx.fillStyle = '#CF142B';
        ctx.fillRect(x + (w - cross) / 2, y, cross, h);
        ctx.fillRect(x, y + (h - cross) / 2, w, cross);
        break;
      }

      case 'it': {
        const s = w / 3;
        ctx.fillStyle = '#009246';
        ctx.fillRect(x, y, s + 0.5, h);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x + s, y, s + 0.5, h);
        ctx.fillStyle = '#CE2B37';
        ctx.fillRect(x + 2 * s, y, s + 1, h);
        break;
      }

      case 'nl': {
        const s = h / 3;
        ctx.fillStyle = '#AE1C28';
        ctx.fillRect(x, y, w, s + 0.5);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y + s, w, s + 0.5);
        ctx.fillStyle = '#21468B';
        ctx.fillRect(x, y + 2 * s, w, s + 1);
        break;
      }

      case 'hr': {
        const s = h / 3;
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(x, y, w, s + 0.5);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y + s, w, s + 0.5);
        ctx.fillStyle = '#171796';
        ctx.fillRect(x, y + 2 * s, w, s + 1);

        // سپر شطرنجی کرواسی
        const cx = x + w / 2;
        const cy = y + h / 2;
        const sw = w * 0.24;
        const sh = h * 0.34;
        const sx = cx - sw / 2;
        const sy = cy - sh / 2 + h * 0.03;

        // تاج آبی بالا
        ctx.fillStyle = '#0093DD';
        ctx.fillRect(sx, sy - sh * 0.22, sw, sh * 0.22);

        // شبکه ۵×۵ قرمز و سفید
        const cellW = sw / 5;
        const cellH = sh / 5;
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 5; c++) {
            ctx.fillStyle = (r + c) % 2 === 0 ? '#FF0000' : '#FFFFFF';
            ctx.fillRect(sx + c * cellW, sy + r * cellH, cellW + 0.3, cellH + 0.3);
          }
        }
        ctx.strokeStyle = '#991B1B';
        ctx.lineWidth = Math.max(0.8, sw * 0.04);
        ctx.strokeRect(sx, sy, sw, sh);
        break;
      }

      case 'ma': {
        ctx.fillStyle = '#C1272D';
        ctx.fillRect(x, y, w, h);
        drawPentagramOutline(
          ctx,
          x + w / 2,
          y + h / 2,
          Math.min(w, h) * 0.24,
          Math.max(1.8, Math.min(w, h) * 0.045),
          '#006233'
        );
        break;
      }

      default: {
        ctx.fillStyle = '#334155';
        ctx.fillRect(x, y, w, h);
      }
    }

    ctx.restore();
  }

  /**
   * کش کردن پرچم دایره‌ای باکیفیت بالا برای مهره‌ها (عملکرد ۶۰ فریم پایدار)
   */
  function getCircleFlagCanvas(id, diameter) {
    const size = Math.ceil(diameter * 2); // 2x supersampling برای شفافیت رتینا
    const key = id + '_' + size;
    if (flagCache.has(key)) {
      return flagCache.get(key);
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();

    // رسم پرچم با نسبت مستطیلی زیبا داخل دایره
    const flagW = size * 1.32;
    const flagH = size;
    drawFlagRect(ctx, id, (size - flagW) / 2, 0, flagW, flagH);
    ctx.restore();

    flagCache.set(key, canvas);
    return canvas;
  }

  /**
   * تولید Data URL برای نمایش پرچم در رابط کاربری (کارت تیم‌ها و تابلوی امتیازات)
   */
  function getFlagDataURL(id, w = 96, h = 64) {
    const key = 'url_' + id + '_' + w + 'x' + h;
    if (flagCache.has(key)) {
      return flagCache.get(key);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    drawFlagRect(ctx, id, 0, 0, w, h);

    // افکت بافت ملایم پارچه پرچم
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, 'rgba(255,255,255,0.16)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.0)');
    grad.addColorStop(0.65, 'rgba(0,0,0,0.06)');
    grad.addColorStop(1, 'rgba(255,255,255,0.08)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const url = canvas.toDataURL('image/png');
    flagCache.set(key, url);
    return url;
  }

  return {
    TEAMS,
    getTeamById,
    drawFlagRect,
    getCircleFlagCanvas,
    getFlagDataURL
  };
})();
