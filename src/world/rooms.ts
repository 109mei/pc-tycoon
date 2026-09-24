import type { Graphics } from 'pixi.js';
import type { GameState, Lane } from '../core/types';
import type { Balance } from '../data/schema';
import { IsoPainter, shade, type BoxColors } from './iso';
import { ROOM_LAYOUT, type RoomLayout } from './layout';
import type { RoomPalette } from './palette';
import { drawShell, drawWindow, type FloorKind } from './shell';

/**
 * 3つの部屋。shell は変わらない部分（台・床・壁・窓）、scene は数で変わる物と家具。
 * 物は実際の数だけ描き、多くなったら積み上げる。
 */

const FLOOR: Record<Lane, FloorKind> = { dis: 'concrete', asm: 'wood', ship: 'tile' };

export function drawRoomShell(g: Graphics, lane: Lane, pal: RoomPalette): void {
  const L = ROOM_LAYOUT[lane];
  const p = drawShell(g, L, pal, FLOOR[lane]);
  if (lane === 'dis') {
    drawWindow(p, pal, 'right', 7.0, 9.3, 1.0, 2.05);
  } else if (lane === 'asm') {
    drawWindow(p, pal, 'left', 2.0, 4.9, 1.0, 2.1);
    // 壁のポスター
    p.wallY(0.01, 8.3, 9.5, 1.15, 2.3, pal.posterFrame);
    p.wallY(0.02, 8.42, 9.38, 1.27, 2.18, pal.posterInner);
    p.wallY(0.03, 8.6, 9.2, 1.45, 1.75, shade(pal.posterFrame, 0.25));
  } else {
    // 玄関のドア
    const dx0 = 6.9;
    const dx1 = 8.2;
    if (pal.doorGlow) p.wallY(0.01, dx0 - 0.4, dx1 + 0.4, 0, 2.55, pal.door, 0.14);
    p.wallY(0.01, dx0, dx1, 0, 2.2, pal.windowFrame);
    p.wallY(0.02, dx0 + 0.1, dx1 - 0.1, 0, 2.1, pal.door);
    p.wallY(0.03, dx1 - 0.35, dx1 - 0.22, 0.95, 1.05, shade(pal.door, -0.35));
    // 掲示板（注文票は scene で貼る）
    p.wallY(0.01, 0.8, 3.9, 1.35, 2.4, pal.cork);
  }
}

export interface SceneInfo {
  /** 描き直しが要るかを見分ける鍵 */
  key: string;
  draw(g: Graphics, pal: RoomPalette): void;
}

/** 積み上げる置き場所。列 × 奥行き × 段 */
function stackSlots(
  x0: number,
  y0: number,
  cols: number,
  rows: number,
  layers: number,
  sx: number,
  sy: number,
  sz: number,
): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let k = 0; k < layers; k++) {
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) out.push([x0 + i * sx, y0 + j * sy, k * sz]);
    }
  }
  return out;
}

/** 奥から手前の順（奥の物を先に描く）に並べる */
function byDepth<T extends { x: number; y: number; z: number }>(items: T[]): T[] {
  return items.sort((a, b) => a.x + a.y - (b.x + b.y) || a.z - b.z);
}

function openBox(p: IsoPainter, x: number, y: number, z: number, w: number, d: number, h: number, pal: RoomPalette) {
  p.box(x, y, z, w, d, h, { ...pal.cardboard, top: pal.cardboardInner });
  const r = 0.08;
  p.flatRect(x, y + d - r, x + w, y + d, z + h, pal.cardboard.top);
  p.flatRect(x + w - r, y, x + w, y + d, z + h, pal.cardboard.top);
  p.wallX(x + r, y + r, y + d - r, z + h - 0.25, z + h, shade(pal.cardboardInner, 0.12));
}

function junkPc(p: IsoPainter, x: number, y: number, z: number, pal: RoomPalette) {
  const w = 1.12;
  const d = 0.88;
  const h = 0.62;
  p.box(x, y, z, w, d, h, pal.junk);
  p.wallX(x + w + 0.005, y + 0.12, y + 0.42, z + 0.3, z + 0.42, pal.junkSlot);
  p.wallX(x + w + 0.005, y + 0.12, y + 0.42, z + 0.12, z + 0.2, pal.junkSlot);
}

function partBox(p: IsoPainter, x: number, y: number, z: number, color: number) {
  p.box(x, y, z, 0.78, 0.52, 0.3, { top: shade(color, 0.16), left: shade(color, -0.16), right: color });
}

function pcTower(p: IsoPainter, x: number, y: number, z: number, pal: RoomPalette, glow: boolean) {
  const w = 0.62;
  const d = 0.95;
  const h = 1.15;
  p.box(x, y, z, w, d, h, pal.pc);
  p.wallX(x + w + 0.005, y + 0.3, y + 0.42, z + h - 0.28, z + h - 0.16, pal.led, glow ? 1 : 0.9);
  p.wallX(x + w + 0.005, y + 0.1, y + d - 0.1, z + h - 0.5, z + h - 0.46, shade(pal.pc.right, 0.25));
}

function packedBox(p: IsoPainter, x: number, y: number, z: number, pal: RoomPalette) {
  const s = 0.82;
  const h = 0.62;
  p.box(x, y, z, s, s, h, pal.cardboard);
  p.flatRect(x + s / 2 - 0.09, y, x + s / 2 + 0.09, y + s, z + h + 0.001, pal.tape);
  p.face(
    [
      [x + s / 2 - 0.09, y + s, z + h],
      [x + s / 2 + 0.09, y + s, z + h],
      [x + s / 2 + 0.09, y + s, z + h - 0.25],
      [x + s / 2 - 0.09, y + s, z + h - 0.25],
    ],
    pal.tape,
  );
}

function kitBox(p: IsoPainter, x: number, y: number, z: number, c: BoxColors) {
  p.box(x, y, z, 0.86, 0.66, 0.36, c);
  p.flatRect(x + 0.1, y + 0.26, x + 0.76, y + 0.4, z + 0.361, shade(c.top, 0.3));
}

function desk(p: IsoPainter, x: number, y: number, w: number, d: number, top: number, pal: RoomPalette) {
  const leg = 0.14;
  const c = pal.furniture;
  const legC: BoxColors = { top: c.left, left: shade(c.left, -0.1), right: c.left };
  p.box(x + 0.08, y + 0.08, 0, leg, leg, top - 0.14, legC);
  p.box(x + w - 0.08 - leg, y + 0.08, 0, leg, leg, top - 0.14, legC);
  p.box(x + 0.08, y + d - 0.08 - leg, 0, leg, leg, top - 0.14, legC);
  p.box(x + w - 0.08 - leg, y + d - 0.08 - leg, 0, leg, leg, top - 0.14, legC);
  p.box(x, y, top - 0.14, w, d, 0.14, c);
}

// ---------------------------------------------------------------- 生産：物置

function productionScene(s: GameState, L: RoomLayout): SceneInfo {
  const junk = s.junk;
  return {
    key: `dis|${junk}`,
    draw(g, pal) {
      const p = new IsoPainter(g, L.frame);
      // 金属ラック（右の壁ぞい）。棚3段に3台ずつ、あふれた分は手前の床に積む
      const rx0 = 0.7;
      const rx1 = 4.6;
      const ry0 = 0.3;
      const ry1 = 1.45;
      const post = 0.1;
      const shelvesZ = [0.25, 1.05, 1.85];
      p.box(rx0, ry0, 0, post, post, 2.4, pal.metalPost);
      p.box(rx1 - post, ry0, 0, post, post, 2.4, pal.metalPost);
      const onRack = Math.min(junk, 9);
      for (let k = 0; k < shelvesZ.length; k++) {
        const z = shelvesZ[k]!;
        p.box(rx0, ry0, z, rx1 - rx0, ry1 - ry0, 0.07, pal.shelf);
        // 作業台に近い右の端から並べる
        for (let i = 2; i >= 0; i--) {
          const n = k * 3 + (2 - i);
          if (n < onRack) junkPc(p, rx0 + 0.2 + i * 1.25, ry0 + 0.16, z + 0.07, pal);
        }
      }
      p.box(rx0, ry1 - post, 0, post, post, 2.4, pal.metalPost);
      p.box(rx1 - post, ry1 - post, 0, post, post, 2.4, pal.metalPost);

      // 仕分け箱（右の壁ぞい）
      const bins = [pal.parts[2]!, pal.parts[0]!, pal.parts[5]!];
      bins.forEach((color, i) => {
        const x = 5.0 + i * 1.12;
        p.box(x, 0.35, 0, 1.0, 0.9, 0.55, pal.bin);
        p.flatRect(x + 0.12, 0.47, x + 0.88, 1.13, 0.47, color);
      });

      const extra: { x: number; y: number; z: number }[] = [];
      const floorSlots = stackSlots(0.5, 2.0, 2, 2, 4, 1.2, 1.0, 0.56);
      for (let n = 0; n < junk - onRack && n < floorSlots.length; n++) {
        const [x, y, z] = floorSlots[n]!;
        extra.push({ x, y, z });
      }
      for (const it of byDepth(extra)) junkPc(p, it.x, it.y, it.z, pal);

      // 作業台と開けたジャンクPC
      desk(p, 3.8, 3.0, 3.1, 1.55, 0.95, pal);
      p.flatRect(3.95, 3.12, 6.75, 4.42, 0.951, pal.mat);
      p.box(4.2, 3.3, 0.95, 1.55, 0.95, 0.38, pal.junk);
      p.flatRect(4.32, 3.42, 5.63, 4.13, 1.331, pal.board);
      p.box(4.5, 3.55, 1.33, 0.4, 0.3, 0.06, { top: 0xe3b23c, left: 0xb58a22, right: 0xd1a12e });
      p.box(6.0, 3.35, 0.95, 0.5, 0.36, 0.08, { top: 0x6f95e3, left: 0x3a5fb0, right: 0x4b78d6 });
      p.box(5.95, 3.85, 0.95, 0.42, 0.32, 0.07, { top: 0xf0c75a, left: 0xb58a22, right: 0xe3b23c });

      // 届いた段ボール
      openBox(p, 4.8, 7.4, 0, 1.15, 1.1, 0.66, pal);
    },
  };
}

// ---------------------------------------------------------------- 制作：作業部屋

/** 部品の山の置き場所。真ん中に積み、多いときは周りにこぼれる */
const PILE: [number, number, number][] = (() => {
  const out: [number, number, number][] = [];
  const cx = 5.7;
  const cy = 6.1;
  const core: [number, number][] = [
    [0, 0], [0.82, 0], [0, 0.56], [0.82, 0.56], [-0.82, 0], [-0.82, 0.56], [0, -0.56], [0.82, -0.56], [-0.82, -0.56],
  ];
  const layers: [number, number][][] = [core, core.slice(0, 6), core.slice(0, 4), core.slice(0, 2)];
  layers.forEach((pos, k) => {
    for (const [dx, dy] of pos) out.push([cx + dx + k * 0.18, cy + dy + k * 0.12, k * 0.3]);
  });
  // こぼれた部品（床に広がる）
  const ring: [number, number][] = [
    [1.9, 0.9], [-1.7, 1.2], [1.8, -1.1], [0.2, 1.6], [-2.2, -0.2], [2.5, 0.1], [-0.9, 1.9], [1.2, 1.9],
    [-2.4, 0.9], [2.6, -0.8], [0.9, -1.5], [-1.2, -1.4], [3.0, 1.0], [-3.0, 0.4], [1.9, 2.3], [-2.0, 2.2],
  ];
  for (let k = 0; k < 3; k++) {
    for (const [dx, dy] of ring) out.push([cx + dx + k * 0.1, cy + dy + k * 0.08, k * 0.3]);
  }
  return out;
})();

function assemblyScene(s: GameState, L: RoomLayout): SceneInfo {
  const parts = s.parts;
  const kits = s.sub !== null ? s.sub.kits : 0;
  return {
    key: `asm|${parts}|${kits}`,
    draw(g, pal) {
      const p = new IsoPainter(g, L.frame);
      if (pal.lightPoolAlpha > 0) {
        p.flatRect(3.3, 0.2, 9.0, 3.4, 0.001, pal.lightPool, pal.lightPoolAlpha);
      }
      // 作業机（右の壁ぞい）
      desk(p, 3.6, 0.3, 4.9, 2.0, 1.0, pal);
      // 中の基板が見える開けたPCケース
      p.box(3.85, 0.5, 1.0, 1.25, 1.2, 1.5, pal.pc);
      p.wallY(1.7 + 0.005, 3.98, 4.97, 1.14, 2.36, pal.board);
      p.wallY(1.7 + 0.01, 4.1, 4.5, 1.9, 2.2, 0xe3b23c);
      p.wallY(1.7 + 0.01, 4.55, 4.85, 1.3, 1.55, 0x4b78d6);
      p.wallY(1.7 + 0.01, 4.1, 4.4, 1.3, 1.6, 0xeef1f5);
      // モニター
      p.box(6.75, 0.85, 1.0, 0.36, 0.3, 0.3, pal.bezel);
      p.box(6.05, 0.62, 1.28, 1.75, 0.14, 1.05, pal.bezel);
      if (pal.screenGlow) p.wallY(0.9, 5.8, 8.05, 1.1, 2.55, pal.screen, 0.14);
      p.wallY(0.76 + 0.005, 6.13, 7.72, 1.36, 2.25, pal.screen);
      // キーボードと小物
      p.flatRect(6.1, 1.55, 7.6, 2.12, 1.001, pal.mat);
      p.box(6.3, 1.65, 1.0, 0.45, 0.3, 0.06, { top: 0xf0c75a, left: 0xb58a22, right: 0xe3b23c });
      p.box(6.9, 1.75, 1.0, 0.5, 0.26, 0.06, { top: 0x6f95e3, left: 0x3a5fb0, right: 0x4b78d6 });
      // いす
      p.box(5.55, 3.35, 0, 0.12, 0.12, 0.5, pal.chair);
      p.box(5.1, 2.95, 0.5, 0.95, 0.9, 0.13, pal.chair);
      p.box(5.1, 3.75, 0.63, 0.95, 0.12, 0.8, pal.chair);

      // 支給キット（下請け）
      const kitSlots = stackSlots(7.7, 2.75, 1, 2, 3, 1, 0.75, 0.37);
      for (let i = 0; i < kits && i < kitSlots.length; i++) {
        const [x, y, z] = kitSlots[i]!;
        kitBox(p, x, y, z, pal.kit);
      }

      // 床の部品の山
      const items: { x: number; y: number; z: number; color: number }[] = [];
      for (let i = 0; i < parts; i++) {
        const slot = PILE[i % PILE.length]!;
        const lift = Math.floor(i / PILE.length) * 0.9;
        items.push({ x: slot[0], y: slot[1], z: slot[2] + lift, color: pal.parts[(i * 7 + 3) % pal.parts.length]! });
      }
      for (const it of byDepth(items)) partBox(p, it.x, it.y, it.z, it.color);
    },
  };
}

// ---------------------------------------------------------------- 販売：玄関の梱包場所

function salesScene(s: GameState, L: RoomLayout, bal: Balance): SceneInfo {
  const orders = s.orders.length;
  const pcs = s.pcs;
  let shipping = s.player.task?.lane === 'ship' ? 1 : 0;
  for (const w of s.workers) if (w.task?.lane === 'ship') shipping += 1;
  let waiting = 0;
  for (const t of s.recent.sold) if (t > s.t - bal.display.shippedBoxSeconds) waiting += 1;
  const boxes = shipping + waiting;
  return {
    key: `ship|${orders}|${pcs}|${boxes}`,
    draw(g, pal) {
      const p = new IsoPainter(g, L.frame);
      // 注文票（待っている注文の数だけ）
      for (let i = 0; i < orders; i++) {
        const col = i % 4;
        const row = Math.floor(i / 4) % 2;
        const layer = Math.floor(i / 8);
        const x = 1.0 + col * 0.72 + layer * 0.18;
        const z = 2.05 - row * 0.5 - layer * 0.08;
        p.wallY(0.02, x, x + 0.56, z - 0.32, z, pal.slip);
        p.wallY(0.03, x + 0.24, x + 0.32, z - 0.06, z + 0.02, pal.pin);
        p.wallY(0.03, x + 0.1, x + 0.46, z - 0.2, z - 0.16, shade(pal.slip, -0.25));
      }
      // 梱包台：開いた段ボール・ラベルプリンター・スマホ
      desk(p, 0.8, 0.3, 3.6, 1.55, 0.95, pal);
      p.box(1.4, 0.55, 0.95, 0.62, 0.55, 0.3, pal.printer);
      p.flatRect(1.52, 0.66, 1.9, 0.98, 1.251, shade(pal.printer.top, -0.2));
      openBox(p, 2.55, 0.45, 0.95, 1.2, 1.05, 0.55, pal);
      p.flatRect(1.0, 1.25, 1.55, 1.7, 0.951, pal.phone);
      p.flatRect(1.06, 1.3, 1.49, 1.65, 0.952, pal.phoneScreen);

      const items: { x: number; y: number; z: number; kind: 'pc' | 'box' }[] = [];
      // 発送待ちの完成品
      const pcSlots = stackSlots(4.7, 1.0, 3, 3, 1, 0.8, 1.15, 0);
      for (let i = 0; i < pcs; i++) {
        const slot = pcSlots[i % pcSlots.length]!;
        const lift = Math.floor(i / pcSlots.length) * 1.15;
        items.push({ x: slot[0], y: slot[1], z: slot[2] + lift, kind: 'pc' });
      }
      // 梱包済みの箱（梱包中と、集荷を待つ箱）
      const boxSlots = stackSlots(6.6, 2.4, 2, 2, 3, 0.9, 0.9, 0.62);
      for (let i = 0; i < boxes && i < boxSlots.length; i++) {
        const [x, y, z] = boxSlots[i]!;
        items.push({ x, y, z, kind: 'box' });
      }
      for (const it of byDepth(items)) {
        if (it.kind === 'pc') pcTower(p, it.x, it.y, it.z, pal, pal.screenGlow);
        else packedBox(p, it.x, it.y, it.z, pal);
      }

      // 外の道路と集荷のバン
      const rx0 = 9.2;
      const rx1 = 11.5;
      p.box(rx0, -0.4, -0.95, rx1 - rx0, 6.2, 0.45, pal.road);
      for (let y = 0.4; y < 5.6; y += 1.5) p.flatRect(10.25, y, 10.45, y + 0.7, -0.499, pal.roadStripe);
      const vx = 9.45;
      const vy = 0.2;
      const vw = 1.6;
      const base = -0.5;
      // 荷台
      p.box(vx, vy, base, vw, 3.0, 1.45, pal.van);
      p.face(
        [
          [vx + vw + 0.005, vy + 0.35, base + 0.35],
          [vx + vw + 0.005, vy + 2.75, base + 0.75],
          [vx + vw + 0.005, vy + 2.75, base + 0.9],
          [vx + vw + 0.005, vy + 0.35, base + 0.5],
        ],
        pal.vanStripe,
      );
      // 運転席
      p.box(vx, vy + 3.0, base, vw, 0.95, 1.05, pal.van);
      p.face(
        [
          [vx + 0.14, vy + 3.95 + 0.005, base + 0.55],
          [vx + vw - 0.14, vy + 3.95 + 0.005, base + 0.55],
          [vx + vw - 0.14, vy + 3.95 + 0.005, base + 0.95],
          [vx + 0.14, vy + 3.95 + 0.005, base + 0.95],
        ],
        pal.vanWindow,
      );
      p.face(
        [
          [vx + vw + 0.005, vy + 3.1, base + 0.55],
          [vx + vw + 0.005, vy + 3.8, base + 0.55],
          [vx + vw + 0.005, vy + 3.8, base + 0.92],
          [vx + vw + 0.005, vy + 3.1, base + 0.92],
        ],
        pal.vanWindow,
      );
    },
  };
}

export function roomScene(lane: Lane, s: GameState, bal: Balance): SceneInfo {
  const L = ROOM_LAYOUT[lane];
  if (lane === 'dis') return productionScene(s, L);
  if (lane === 'asm') return assemblyScene(s, L);
  return salesScene(s, L, bal);
}
