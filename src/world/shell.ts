import type { Graphics } from 'pixi.js';
import { IsoPainter, project } from './iso';
import type { RoomLayout } from './layout';
import type { RoomPalette } from './palette';

export type FloorKind = 'concrete' | 'wood' | 'tile';

/** 背景に浮かぶ一枚の台：影 → 台の側面 → 床 → 壁 */
export function drawShell(g: Graphics, L: RoomLayout, pal: RoomPalette, floor: FloorKind): IsoPainter {
  const p = new IsoPainter(g, L.frame);
  const { w, d, wallH: H, wallT: T, slab: S } = L;

  // 台の下の影
  const left = project(L.frame, 0, d, 0);
  const right = project(L.frame, w, 0, 0);
  const front = project(L.frame, w, d, 0);
  g.ellipse((left.x + right.x) / 2, front.y + 24, ((right.x - left.x) / 2) * 0.84, 24).fill(pal.shadow);

  const floorColor = floor === 'concrete' ? pal.concrete : floor === 'wood' ? pal.wood : pal.tile;
  p.box(-T, -T, -S, w + T, d + T, S, { top: floorColor, left: pal.slabLeft, right: pal.slabRight });

  if (floor === 'wood') {
    // 板の継ぎ目（右の壁と平行）
    const step = 0.92;
    for (let y = step; y < d - 0.2; y += step) p.flatRect(0, y - 0.035, w, y + 0.035, 0, pal.woodPlank);
    for (let i = 0; i * step < d; i++) {
      const x = ((i * 3.7) % (w - 1)) + 0.5;
      p.flatRect(x - 0.035, i * step, x + 0.035, Math.min(d, (i + 1) * step), 0, pal.woodPlank);
    }
  } else if (floor === 'tile') {
    const n = 6;
    const sx = w / n;
    const sy = d / n;
    for (let i = 1; i < n; i++) {
      p.flatRect(i * sx - 0.03, 0, i * sx + 0.03, d, 0, pal.tileGrout);
      p.flatRect(0, i * sy - 0.03, w, i * sy + 0.03, 0, pal.tileGrout);
    }
  }

  // 右の壁（奥の角を含む）と左の壁
  p.box(-T, -T, 0, w + T, T, H, { top: pal.wallTop, left: pal.wallRight, right: pal.wallEnd });
  p.box(-T, 0, 0, T, d, H, { top: pal.wallTop, left: pal.wallEnd, right: pal.wallLeft });
  return p;
}

/** 詰まっている列の部屋は、床の縁を列の色で光らせる */
export function drawEdgeGlow(g: Graphics, L: RoomLayout, color: number): void {
  const b = 0.24;
  const flat = (pts: [number, number][]) => pts.flatMap(([x, y]) => {
    const q = project(L.frame, x, y, 0);
    return [q.x, q.y];
  });
  g.poly(flat([[0, 0], [L.w, 0], [L.w, L.d], [0, L.d]])).fill({ color });
  g.poly(flat([[b, b], [L.w - b, b], [L.w - b, L.d - b], [b, L.d - b]])).cut();
}

/** 壁の窓（左の壁は x=0、右の壁は y=0 の面） */
export function drawWindow(
  p: IsoPainter,
  pal: RoomPalette,
  wall: 'left' | 'right',
  a0: number,
  a1: number,
  z0: number,
  z1: number,
): void {
  const f = 0.1;
  const mid = (a0 + a1) / 2;
  const put = (b0: number, b1: number, c0: number, c1: number, color: number, alpha = 1) => {
    if (wall === 'left') p.wallX(0.01, b0, b1, c0, c1, color, alpha);
    else p.wallY(0.01, b0, b1, c0, c1, color, alpha);
  };
  if (pal.glassGlow) put(a0 - 0.35, a1 + 0.35, z0 - 0.3, z1 + 0.3, pal.glass, 0.12);
  put(a0, a1, z0, z1, pal.windowFrame);
  put(a0 + f, mid - f / 2, z0 + f, z1 - f, pal.glass);
  put(mid + f / 2, a1 - f, z0 + f, z1 - f, pal.glass);
}
