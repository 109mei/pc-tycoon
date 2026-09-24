import type { Graphics } from 'pixi.js';
import type { Lane } from '../core/types';
import { PERSON, type PersonSpot } from './layout';
import type { RoomPalette } from './palette';

/** 部屋の人（足元の輪・体・頭）と、頭の上の進み具合の輪。名札は HTML 側で重ねる */
export function drawPeople(g: Graphics, pal: RoomPalette, people: PersonSpot[]): void {
  for (const who of people) {
    const { x, y } = who;
    const ring = who.worker ? pal.workerRing : pal.playerRing;
    g.ellipse(x, y, 16, 8).fill({ color: ring });
    g.ellipse(x, y, 12.5, 5.9).cut();
    g.ellipse(x, y - 1, 8, 3.6).fill({ color: pal.personShadow, alpha: 0.22 });
    g.roundRect(x - 8, y - 29, 16, 27, 8).fill({ color: who.worker ? pal.workerBody : pal.playerBody });
    g.circle(x, y + PERSON.headY - 1.5, 7.2).fill({ color: pal.hair });
    g.ellipse(x, y + PERSON.headY + 1.5, 6.4, 5).fill({ color: pal.skin });
  }
}

export function drawProgressRings(
  g: Graphics,
  pal: RoomPalette,
  people: PersonSpot[],
  lane: Lane,
): void {
  for (const who of people) {
    const task = who.task;
    if (task === null) continue;
    const cx = who.x;
    const cy = who.y + PERSON.ringY;
    const progress = Math.max(0, Math.min(1, 1 - task.remaining / task.total));
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
