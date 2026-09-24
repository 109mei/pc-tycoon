import type { Graphics } from 'pixi.js';
import type { Lane } from '../core/types';
import { faceShade, shade, softShadow } from './gfx';
import { PERSON, type PersonSpot } from './layout';
import type { RoomPalette } from './palette';

/**
 * 部屋の人（足元の輪・影・脚・胴・腕・頭）と、頭の上の進み具合の輪。名札は HTML 側で重ねる。
 * 作業中は列ごとの動き（分解＝振り下ろす、組み立て＝両手を細かく、発送＝横に動かす）をする。
 */
export function drawPeople(g: Graphics, pal: RoomPalette, people: PersonSpot[], nowMs: number): void {
  const t = nowMs / 1000;
  people.forEach((who, idx) => {
    const { x, y } = who;
    const working = who.task !== null;
    const lane: Lane | null = who.task?.lane ?? null;
    const phase = t * Math.PI * 2 + idx * 1.7;
    const shirt = who.worker ? pal.workerShirt : pal.playerShirt;
    const ringColor = who.worker ? pal.workerRing : pal.playerRing;

    // 足元の輪と影
    g.ellipse(x, y, 17, 8.5).fill({ color: ringColor });
    g.ellipse(x, y, 13.5, 6.3).cut();
    g.ellipse(x, y - 0.5, 11, 5).fill({ fill: softShadow() });

    const bob = working ? -Math.abs(Math.sin(phase * 1.1)) * 1.3 : Math.sin(phase * 0.35) * 0.5;
    const by = y + bob;

    // 脚
    g.roundRect(x - 6.5, by - 17, 5.5, 16, 2.5).fill({ color: pal.pants });
    g.roundRect(x + 1, by - 17, 5.5, 16, 2.5).fill({ color: shade(pal.pants, -0.12) });
    g.roundRect(x - 7, by - 3, 6.5, 3.2, 1.5).fill({ color: 0x1f242c });
    g.roundRect(x + 0.5, by - 3, 6.5, 3.2, 1.5).fill({ color: 0x1f242c });

    // 腕（胴の後ろ側を先に）
    const shoulderY = by - 31;
    const arm = (side: -1 | 1, ang: number, lift: number) => {
      const sx = x + side * 8.2;
      const len = 13;
      const ex = sx + Math.sin(ang) * len * side * 0.55;
      const ey = shoulderY + Math.cos(ang) * len - lift;
      g.moveTo(sx, shoulderY).lineTo(ex, ey).stroke({ width: 4.6, color: shade(shirt, side === 1 ? -0.12 : -0.04), cap: 'round' });
      g.circle(ex, ey, 2.6).fill({ color: pal.skin });
    };
    let aL = 0.15;
    let aR = 0.15;
    let lL = 0;
    let lR = 0;
    if (working && lane === 'dis') {
      aR = 0.9 + Math.sin(phase * 1.8) * 0.8;
      lR = 4 + Math.max(0, Math.sin(phase * 1.8)) * 5;
      aL = 0.5;
      lL = 3;
    } else if (working && lane === 'asm') {
      aL = 0.7 + Math.sin(phase * 2.6) * 0.25;
      aR = 0.7 + Math.sin(phase * 2.6 + 1.6) * 0.25;
      lL = 5;
      lR = 5;
    } else if (working && lane === 'ship') {
      aL = 0.8 + Math.sin(phase * 1.4) * 0.5;
      aR = 0.8 - Math.sin(phase * 1.4) * 0.5;
      lL = 4;
      lR = 4;
    }
    arm(1, aR, lR);

    // 胴
    g.roundRect(x - 8.5, by - 35, 17, 20, 6).fill({ color: shirt });
    g.roundRect(x - 8.5, by - 35, 17, 20, 6).fill({ fill: faceShade() });
    if (who.worker) g.roundRect(x - 5.5, by - 30, 11, 4, 2).fill({ color: shade(shirt, 0.3) });

    arm(-1, aL, lL);

    // 頭（髪→顔→目）。アルバイトは帽子
    const hy = by + PERSON.headY;
    g.circle(x, hy - 1.8, 7.8).fill({ color: pal.hair });
    g.ellipse(x, hy + 1.6, 6.9, 5.9).fill({ color: pal.skin });
    g.circle(x - 2.4, hy + 1.8, 0.95).fill({ color: 0x2b2420 });
    g.circle(x + 2.4, hy + 1.8, 0.95).fill({ color: 0x2b2420 });
    if (who.worker) {
      g.ellipse(x, hy - 4.2, 8.4, 4.2).fill({ color: shirt });
      g.roundRect(x - 1, hy - 3.2, 10, 2.6, 1.3).fill({ color: shade(shirt, -0.15) });
    }
  });
}

export function drawProgressRings(g: Graphics, pal: RoomPalette, people: PersonSpot[], lane: Lane): void {
  for (const who of people) {
    const task = who.task;
    if (task === null) continue;
    const cx = who.x;
    const cy = who.y + PERSON.ringY;
    const progress = Math.max(0, Math.min(1, 1 - task.remaining / task.total));
    g.circle(cx, cy + 1.2, 13.5).fill({ color: 0x000000, alpha: 0.12 });
    g.circle(cx, cy, 13).fill({ color: pal.ringDisc });
    g.circle(cx, cy, 10.5).stroke({ width: 3, color: pal.ringTrack });
    if (progress > 0.001) {
      const a0 = -Math.PI / 2;
      const a1 = a0 + progress * Math.PI * 2;
      g.moveTo(cx + Math.cos(a0) * 10.5, cy + Math.sin(a0) * 10.5)
        .arc(cx, cy, 10.5, a0, a1)
        .stroke({ width: 3, color: pal.laneArc[task.lane] ?? pal.laneArc[lane], cap: 'round' });
    }
  }
}
