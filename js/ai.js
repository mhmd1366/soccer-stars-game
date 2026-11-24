/**
 * js/ai.js
 * هوش مصنوعی در ۳ سطح دشواری: آسان (خطای زاویه)، متوسط (هدف‌گیری مستقیم) و حرفه‌ای (شوت بانکی و دفاع دروازه)
 */

window.SoccerAI = (function () {
  'use strict';

  function dist(ax, ay, bx, by) {
    return Math.hypot(bx - ax, by - ay);
  }

  /**
   * بررسی باز بودن مسیر مستقیم بین دو نقطه نسبت به سایر مهره‌ها
   */
  function countObstacles(ax, ay, bx, by, obstacles, clearance) {
    const vx = bx - ax;
    const vy = by - ay;
    const lenSq = vx * vx + vy * vy;
    if (lenSq < 1) return 0;

    let count = 0;
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      const t = ((o.x - ax) * vx + (o.y - ay) * vy) / lenSq;
      if (t > 0.06 && t < 0.94) {
        const px = ax + t * vx;
        const py = ay + t * vy;
        const d = Math.hypot(o.x - px, o.y - py);
        if (d < o.r + clearance) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * محاسبه نقطه برخورد بهینه روی توپ برای ارسال توپ به سمت هدف (tx, ty)
   */
  function getGhostImpactPoint(ball, tx, ty, puckRadius) {
    const dx = tx - ball.x;
    const dy = ty - ball.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const offset = ball.r + puckRadius * 0.96;
    return {
      x: ball.x - ux * offset,
      y: ball.y - uy * offset,
      dirX: ux,
      dirY: uy
    };
  }

  /**
   * انتخاب بهترین حرکت برای تیم هوش مصنوعی (تیم ۲ که به دروازه چپ حمله می‌کند)
   */
  function computeMove(pucks, ball, difficulty, world) {
    const aiPucks = pucks.filter(p => p.team === 2);
    const enemyPucks = pucks.filter(p => p.team === 1);
    const targetGoalX = world.fieldLeft - 12;
    const ownGoalX = world.fieldRight - 28;
    const goalCenterY = world.centerY;

    // نقاط هدف داخل دهانه دروازه حریف (مرکز، گوشه بالا، گوشه پایین)
    const goalTargets = [
      { x: targetGoalX, y: goalCenterY },
      { x: targetGoalX, y: world.goalTop + 34 },
      { x: targetGoalX, y: world.goalBottom - 34 }
    ];

    // نقاط شوت بانکی (آینه‌کردن دروازه نسبت به دیواره بالا و پایین برای سطح حرفه‌ای)
    const bankTargets = [
      { x: targetGoalX, y: 2 * world.fieldTop - goalCenterY, isBank: true },
      { x: targetGoalX, y: 2 * world.fieldBottom - goalCenterY, isBank: true }
    ];

    // --- سطح آسان: انتخاب نیمه‌تصادفی و خطای زاویه مشهود ---
    if (difficulty === 'easy') {
      const sorted = [...aiPucks].sort((a, b) => dist(a.x, a.y, ball.x, ball.y) - dist(b.x, b.y, ball.x, ball.y));
      const chosen = Math.random() < 0.72 ? sorted[0] : sorted[Math.min(1, sorted.length - 1)];
      const aim = getGhostImpactPoint(ball, targetGoalX, goalCenterY, chosen.r);

      let angle = Math.atan2(aim.y - chosen.y, aim.x - chosen.x);
      // اگر مهره جلوی توپ باشد، فقط به سمت خود توپ ضربه بزند
      if (chosen.x < ball.x - 10) {
        angle = Math.atan2(ball.y - chosen.y, ball.x - chosen.x);
      }
      // اعمال خطای زاویه برای حس طبیعی سطح آسان
      const error = (Math.random() - 0.5) * 0.42;
      angle += error;
      const power = 0.52 + Math.random() * 0.34;
      const speed = power * world.maxShotSpeed;

      return {
        puck: chosen,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed
      };
    }

    // ارزیابی کاندیداها برای سطح متوسط و حرفه‌ای
    let bestMove = null;
    let bestScore = -Infinity;

    const candidateTargets = difficulty === 'pro'
      ? [...goalTargets, ...bankTargets]
      : [goalTargets[0], goalTargets[1], goalTargets[2]];

    for (let i = 0; i < aiPucks.length; i++) {
      const puck = aiPucks[i];
      const others = pucks.filter(p => p.id !== puck.id);

      for (let t = 0; t < candidateTargets.length; t++) {
        const target = candidateTargets[t];
        const ghost = getGhostImpactPoint(ball, target.x, target.y, puck.r);

        // نقطه برخورد باید داخل محدوده منطقی زمین باشد
        if (
          ghost.x < world.fieldLeft + 10 ||
          ghost.x > world.fieldRight - 10 ||
          ghost.y < world.fieldTop + 10 ||
          ghost.y > world.fieldBottom - 10
        ) {
          continue;
        }

        const dx = ghost.x - puck.x;
        const dy = ghost.y - puck.y;
        const dToGhost = Math.hypot(dx, dy) || 1;
        const shotUx = dx / dToGhost;
        const shotUy = dy / dToGhost;

        // هم‌راستایی ضربه مهره با خط توپ-دروازه (dot product)
        const alignment = shotUx * ghost.dirX + shotUy * ghost.dirY;
        if (alignment < 0.22) continue;

        const obsToBall = countObstacles(puck.x, puck.y, ghost.x, ghost.y, others, puck.r * 0.85);
        const obsToGoal = target.isBank
          ? countObstacles(ball.x, ball.y, target.x, target.y, others, ball.r * 0.7) * 0.5
          : countObstacles(ball.x, ball.y, target.x, target.y, others, ball.r * 0.9);

        const distBallToGoal = dist(ball.x, ball.y, targetGoalX, goalCenterY);

        let score =
          alignment * 145 -
          dToGhost * 0.16 -
          distBallToGoal * 0.05 -
          obsToBall * 95 -
          obsToGoal * 55;

        if (target.isBank) {
          score -= 22; // ترجیح شوت مستقیم مگر اینکه مسیر مستقیم بسته باشد
        }

        // پاداش بیشتر اگر مهره سمت راست توپ باشد (حمله به سمت چپ)
        if (puck.x > ball.x) score += 25;

        // تعیین قدرت ضربه متناسب با فاصله
        let power = Math.min(0.98, Math.max(0.55, (dToGhost + distBallToGoal * 0.45) / 760));
        if (target.isBank) power = Math.min(1.0, power + 0.14);

        if (score > bestScore) {
          bestScore = score;
          bestMove = {
            puck,
            angle: Math.atan2(dy, dx),
            power
          };
        }
      }
    }

    // --- منطق دفاعی ویژه سطح حرفه‌ای (دفاع جلوی دروازه هنگام خطر) ---
    if (difficulty === 'pro') {
      const ballInDanger = ball.x > world.centerX + 150;
      const goalProtected = aiPucks.some(
        p => p.x > world.fieldRight - 140 && Math.abs(p.y - goalCenterY) < 75
      );

      if (ballInDanger && (!bestMove || bestScore < 45)) {
        // اگر دروازه خالی است و موقعیت شوت خوبی نداریم، یک مهره را جلوی خط دروازه بگذاریم یا توپ را دور کنیم
        if (!goalProtected) {
          const defender = [...aiPucks].sort(
            (a, b) => dist(a.x, a.y, ownGoalX - 24, goalCenterY) - dist(b.x, b.y, ownGoalX - 24, goalCenterY)
          )[0];

          const targetDefX = world.fieldRight - 58;
          const targetDefY = Math.max(world.goalTop + 34, Math.min(world.goalBottom - 34, ball.y));
          const dDef = dist(defender.x, defender.y, targetDefX, targetDefY);
          const power = Math.min(0.82, Math.max(0.32, dDef / 380));
          const angle = Math.atan2(targetDefY - defender.y, targetDefX - defender.x);

          return {
            puck: defender,
            vx: Math.cos(angle) * power * world.maxShotSpeed,
            vy: Math.sin(angle) * power * world.maxShotSpeed
          };
        }
      }
    }

    // اگر هیچ زاویه شوت مستقیمی پیدا نشد، نزدیک‌ترین مهره توپ را به سمت نیمه حریف هدایت کند
    if (!bestMove) {
      const nearest = [...aiPucks].sort((a, b) => dist(a.x, a.y, ball.x, ball.y) - dist(b.x, b.y, ball.x, ball.y))[0];
      // کمی پشت توپ هدف بگیرد تا آن را به سمت چپ هل دهد
      const aimX = ball.x + (nearest.x < ball.x ? -8 : 10);
      const aimY = ball.y + (ball.y > goalCenterY ? 10 : -10);
      bestMove = {
        puck: nearest,
        angle: Math.atan2(aimY - nearest.y, aimX - nearest.x),
        power: 0.72
      };
    }

    // اعمال دقت متناسب با سطح دشواری
    const noise = difficulty === 'pro' ? (Math.random() - 0.5) * 0.025 : (Math.random() - 0.5) * 0.11;
    const finalAngle = bestMove.angle + noise;
    const finalSpeed = Math.min(1, bestMove.power) * world.maxShotSpeed;

    return {
      puck: bestMove.puck,
      vx: Math.cos(finalAngle) * finalSpeed,
      vy: Math.sin(finalAngle) * finalSpeed
    };
  }

  return {
    computeMove
  };
})();
