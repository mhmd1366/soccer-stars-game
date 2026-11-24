/**
 * js/physics.js
 * موتور فیزیک دوبعدی اختصاصی با Sub-stepping، برخورد کشسان، تیرک‌های دروازه و نسبت جرم/اصطکاک واقعی
 */

window.SoccerPhysics = (function () {
  'use strict';

  // ابعاد منطقی کل بوم زمین (نسبت 5:3 استاندارد برای موبایل و دسکتاپ)
  const WORLD = {
    width: 1120,
    height: 660,
    fieldLeft: 86,
    fieldRight: 1034,
    fieldTop: 46,
    fieldBottom: 614,
    goalWidth: 58,
    goalHeight: 196,
    postRadius: 9,
    puckRadius: 27,
    ballRadius: 15,
    puckMass: 3.4,
    ballMass: 1.0,
    puckFriction: 0.981, // اصطکاک بیشتر برای مهره‌های سنگین
    ballFriction: 0.990, // اصطکاک کمتر برای چرخش و کمانه واقعی توپ
    restitutionPuckPuck: 0.88,
    restitutionPuckBall: 0.95,
    restitutionWall: 0.82,
    restitutionPost: 0.91,
    stopThreshold: 7.5,
    maxShotSpeed: 1380,
    substeps: 8
  };

  WORLD.fieldW = WORLD.fieldRight - WORLD.fieldLeft;
  WORLD.fieldH = WORLD.fieldBottom - WORLD.fieldTop;
  WORLD.centerX = (WORLD.fieldLeft + WORLD.fieldRight) / 2;
  WORLD.centerY = (WORLD.fieldTop + WORLD.fieldBottom) / 2;
  WORLD.goalTop = WORLD.centerY - WORLD.goalHeight / 2;
  WORLD.goalBottom = WORLD.centerY + WORLD.goalHeight / 2;

  // ۴ تیرک ثابت دروازه‌ها با شعاع فیزیکی
  const GOAL_POSTS = [
    { x: WORLD.fieldLeft, y: WORLD.goalTop, r: WORLD.postRadius, side: 1 },
    { x: WORLD.fieldLeft, y: WORLD.goalBottom, r: WORLD.postRadius, side: 1 },
    { x: WORLD.fieldRight, y: WORLD.goalTop, r: WORLD.postRadius, side: 2 },
    { x: WORLD.fieldRight, y: WORLD.goalBottom, r: WORLD.postRadius, side: 2 }
  ];

  // ۳ چینش استاندارد (مختصات نرمال‌شده برای تیم چپ؛ تیم راست آینه می‌شود)
  const FORMATIONS = {
    '1-2-2': {
      name: 'متعادل (1-2-2)',
      short: '1-2-2',
      desc: 'تعادل بین دفاع و حمله',
      coords: [
        [0.09, 0.50], // دروازه‌بان
        [0.24, 0.27], // مدافع بالا
        [0.24, 0.73], // مدافع پایین
        [0.41, 0.33], // مهاجم بالا
        [0.41, 0.67]  // مهاجم پایین
      ]
    },
    '1-3-1': {
      name: 'هجومی (1-3-1)',
      short: '1-3-1',
      desc: 'فشار بالا در میانه زمین',
      coords: [
        [0.08, 0.50], // دروازه‌بان
        [0.28, 0.20], // هافبک چپ
        [0.31, 0.50], // هافبک میانی
        [0.28, 0.80], // هافبک راست
        [0.44, 0.50]  // نوک حمله
      ]
    },
    '2-2-1': {
      name: 'دفاعی (2-2-1)',
      short: '2-2-1',
      desc: 'پوشش محکم محوطه جریمه',
      coords: [
        [0.10, 0.36], // مدافع دروازه بالا
        [0.10, 0.64], // مدافع دروازه پایین
        [0.25, 0.24], // هافبک دفاعی بالا
        [0.25, 0.76], // هافبک دفاعی پایین
        [0.40, 0.50]  // تک‌مهاجم ضدحمله
      ]
    }
  };

  function createEntities(formation1, formation2) {
    const f1 = FORMATIONS[formation1] || FORMATIONS['1-2-2'];
    const f2 = FORMATIONS[formation2] || FORMATIONS['1-2-2'];
    const pucks = [];

    f1.coords.forEach(([nx, ny], idx) => {
      pucks.push({
        id: 'p1_' + idx,
        team: 1,
        x: WORLD.fieldLeft + nx * WORLD.fieldW,
        y: WORLD.fieldTop + ny * WORLD.fieldH,
        vx: 0,
        vy: 0,
        r: WORLD.puckRadius,
        mass: WORLD.puckMass,
        invMass: 1 / WORLD.puckMass,
        isBall: false
      });
    });

    f2.coords.forEach(([nx, ny], idx) => {
      pucks.push({
        id: 'p2_' + idx,
        team: 2,
        x: WORLD.fieldRight - nx * WORLD.fieldW,
        y: WORLD.fieldTop + ny * WORLD.fieldH,
        vx: 0,
        vy: 0,
        r: WORLD.puckRadius,
        mass: WORLD.puckMass,
        invMass: 1 / WORLD.puckMass,
        isBall: false
      });
    });

    const ball = {
      id: 'ball',
      team: 0,
      x: WORLD.centerX,
      y: WORLD.centerY,
      vx: 0,
      vy: 0,
      r: WORLD.ballRadius,
      mass: WORLD.ballMass,
      invMass: 1 / WORLD.ballMass,
      angle: 0,
      isBall: true
    };

    return { pucks, ball };
  }

  function resolveCircleCollision(a, b, events) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const minDist = a.r + b.r;
    const distSq = dx * dx + dy * dy;

    if (distSq >= minDist * minDist || distSq === 0) return;

    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;

    // جداسازی مکانی برای جلوگیری از هم‌پوشانی
    const overlap = minDist - dist;
    const totalInvMass = a.invMass + b.invMass;
    const sepX = nx * (overlap / totalInvMass);
    const sepY = ny * (overlap / totalInvMass);

    a.x -= sepX * a.invMass;
    a.y -= sepY * a.invMass;
    b.x += sepX * b.invMass;
    b.y += sepY * b.invMass;

    // سرعت نسبی در راستای نرمال
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velAlongNormal = rvx * nx + rvy * ny;

    if (velAlongNormal > 0) return;

    const isBallHit = a.isBall || b.isBall;
    const e = isBallHit ? WORLD.restitutionPuckBall : WORLD.restitutionPuckPuck;

    const j = (-(1 + e) * velAlongNormal) / totalInvMass;
    const impulseX = j * nx;
    const impulseY = j * ny;

    a.vx -= impulseX * a.invMass;
    a.vy -= impulseY * a.invMass;
    b.vx += impulseX * b.invMass;
    b.vy += impulseY * b.invMass;

    const impactSpeed = Math.abs(velAlongNormal);
    if (impactSpeed > 45) {
      events.push({
        type: isBallHit ? 'ball' : 'puck',
        x: a.x + nx * a.r,
        y: a.y + ny * a.r,
        intensity: Math.min(1, impactSpeed / 780)
      });
    }
  }

  function resolvePostCollision(body, post, events) {
    const dx = body.x - post.x;
    const dy = body.y - post.y;
    const minDist = body.r + post.r;
    const distSq = dx * dx + dy * dy;

    if (distSq >= minDist * minDist || distSq === 0) return;

    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const ny = dy / dist;

    // بیرون کشیدن از تیرک
    body.x = post.x + nx * minDist;
    body.y = post.y + ny * minDist;

    const vn = body.vx * nx + body.vy * ny;
    if (vn < 0) {
      const e = WORLD.restitutionPost;
      body.vx -= (1 + e) * vn * nx;
      body.vy -= (1 + e) * vn * ny;

      const impactSpeed = Math.abs(vn);
      if (impactSpeed > 40) {
        events.push({
          type: 'post',
          x: post.x + nx * post.r,
          y: post.y + ny * post.r,
          intensity: Math.min(1, impactSpeed / 700)
        });
      }
    }
  }

  function resolveWalls(body, events) {
    const r = body.r;
    const inGoalY = body.y > WORLD.goalTop + r * 0.25 && body.y < WORLD.goalBottom - r * 0.25;
    const e = WORLD.restitutionWall;

    // دیواره‌های بالا و پایین زمین
    if (body.y - r < WORLD.fieldTop) {
      body.y = WORLD.fieldTop + r;
      if (body.vy < 0) {
        const spd = Math.abs(body.vy);
        body.vy = -body.vy * e;
        if (spd > 65) events.push({ type: 'wall', x: body.x, y: WORLD.fieldTop, intensity: Math.min(1, spd / 850) });
      }
    } else if (body.y + r > WORLD.fieldBottom) {
      body.y = WORLD.fieldBottom - r;
      if (body.vy > 0) {
        const spd = Math.abs(body.vy);
        body.vy = -body.vy * e;
        if (spd > 65) events.push({ type: 'wall', x: body.x, y: WORLD.fieldBottom, intensity: Math.min(1, spd / 850) });
      }
    }

    // دیواره چپ و داخل دروازه چپ
    if (!inGoalY) {
      if (body.x - r < WORLD.fieldLeft) {
        // اگر قبلاً وارد محفظه دروازه شده، به دیواره‌های بالا/پایین تور محدود شود
        if (body.x < WORLD.fieldLeft) {
          if (body.y - r < WORLD.goalTop) {
            body.y = WORLD.goalTop + r;
            if (body.vy < 0) body.vy = -body.vy * 0.65;
          }
          if (body.y + r > WORLD.goalBottom) {
            body.y = WORLD.goalBottom - r;
            if (body.vy > 0) body.vy = -body.vy * 0.65;
          }
        } else {
          body.x = WORLD.fieldLeft + r;
          if (body.vx < 0) {
            const spd = Math.abs(body.vx);
            body.vx = -body.vx * e;
            if (spd > 65) events.push({ type: 'wall', x: WORLD.fieldLeft, y: body.y, intensity: Math.min(1, spd / 850) });
          }
        }
      }
    }

    // تور پشت دروازه چپ
    const leftBack = WORLD.fieldLeft - WORLD.goalWidth;
    if (body.x - r < leftBack) {
      body.x = leftBack + r;
      if (body.vx < 0) body.vx = -body.vx * 0.35;
    }

    // دیواره راست و داخل دروازه راست
    if (!inGoalY) {
      if (body.x + r > WORLD.fieldRight) {
        if (body.x > WORLD.fieldRight) {
          if (body.y - r < WORLD.goalTop) {
            body.y = WORLD.goalTop + r;
            if (body.vy < 0) body.vy = -body.vy * 0.65;
          }
          if (body.y + r > WORLD.goalBottom) {
            body.y = WORLD.goalBottom - r;
            if (body.vy > 0) body.vy = -body.vy * 0.65;
          }
        } else {
          body.x = WORLD.fieldRight - r;
          if (body.vx > 0) {
            const spd = Math.abs(body.vx);
            body.vx = -body.vx * e;
            if (spd > 65) events.push({ type: 'wall', x: WORLD.fieldRight, y: body.y, intensity: Math.min(1, spd / 850) });
          }
        }
      }
    }

    // تور پشت دروازه راست
    const rightBack = WORLD.fieldRight + WORLD.goalWidth;
    if (body.x + r > rightBack) {
      body.x = rightBack - r;
      if (body.vx > 0) body.vx = -body.vx * 0.35;
    }

    // جلوگیری از گیر کردن مهره داخل تور دروازه
    if (!body.isBall) {
      if (body.x < WORLD.fieldLeft - WORLD.goalWidth + r) {
        body.x = WORLD.fieldLeft - WORLD.goalWidth + r;
      }
      if (body.x > WORLD.fieldRight + WORLD.goalWidth - r) {
        body.x = WORLD.fieldRight + WORLD.goalWidth - r;
      }
    }
  }

  /**
   * به‌روزرسانی یک فریم کامل با Sub-stepping دقیق
   */
  function step(pucks, ball, dt, goalAlreadyScored) {
    const clampedDt = Math.min(dt, 0.035);
    const subDt = clampedDt / WORLD.substeps;
    const bodies = [...pucks, ball];
    const events = [];
    let goalScoredBy = 0;

    // محاسبه ضریب اصطکاک مستقل از نرخ فریم (بر مبنای ۶۰ فریم)
    const puckDamp = Math.pow(WORLD.puckFriction, subDt * 60);
    const ballDamp = Math.pow(WORLD.ballFriction, subDt * 60);

    for (let s = 0; s < WORLD.substeps; s++) {
      // ۱. انتگرال‌گیری حرکت و اصطکاک
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        b.x += b.vx * subDt;
        b.y += b.vy * subDt;

        const damp = b.isBall ? ballDamp : puckDamp;
        b.vx *= damp;
        b.vy *= damp;

        if (b.isBall) {
          const spd = Math.hypot(b.vx, b.vy);
          b.angle += (spd * subDt) / b.r;
        }
      }

      // ۲. برخورد دو به دو اجسام (مهره-مهره و مهره-توپ)
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          resolveCircleCollision(bodies[i], bodies[j], events);
        }
      }

      // ۳. برخورد با دیواره‌ها و ۴ تیرک دروازه
      for (let i = 0; i < bodies.length; i++) {
        resolveWalls(bodies[i], events);
        for (let p = 0; p < GOAL_POSTS.length; p++) {
          resolvePostCollision(bodies[i], GOAL_POSTS[p], events);
        }
      }

      // ۴. تشخیص گل (عبور کامل مرکز توپ از خط دروازه)
      if (!goalAlreadyScored && goalScoredBy === 0) {
        if (
          ball.y > WORLD.goalTop &&
          ball.y < WORLD.goalBottom
        ) {
          if (ball.x < WORLD.fieldLeft - ball.r * 0.45) {
            goalScoredBy = 2; // گل به دروازه چپ => امتیاز تیم ۲
          } else if (ball.x > WORLD.fieldRight + ball.r * 0.45) {
            goalScoredBy = 1; // گل به دروازه راست => امتیاز تیم ۱
          }
        }
      }
    }

    // ۵. توقف کامل اجسام زیر آستانه سرعت
    let isMoving = false;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      const spd = Math.hypot(b.vx, b.vy);
      if (spd < WORLD.stopThreshold) {
        b.vx = 0;
        b.vy = 0;
      } else {
        isMoving = true;
      }
    }

    return {
      isMoving,
      events,
      goalScoredBy
    };
  }

  return {
    WORLD,
    GOAL_POSTS,
    FORMATIONS,
    createEntities,
    step
  };
})();
