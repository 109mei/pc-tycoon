import type { Graphics } from 'pixi.js';
import type { GameState, Lane } from '../core/types';
import { PART_TYPES } from '../core/types';
import { setsOf } from '../core/state';
import { faceShade, floorFade, Iso, shade, softShadow, sunFade, visualRandom } from './gfx';
import { project } from './isoMath';
import { ASSEMBLY, PRODUCTION, ROOM_LAYOUT, SALES, type RoomLayout } from './layout';
import type { RoomPalette } from './palette';
import {
  bench,
  bin,
  cart,
  chair,
  deskLamp,
  ewasteBin,
  junkPc,
  keyboard,
  kitBox,
  monitor,
  openBox,
  orderBoard,
  packedBox,
  packingTable,
  pcTower,
  plant,
  rack,
  road,
  table,
} from './props';

/**
 * 3つの部屋。shell は変わらない部分（台・床・壁・窓・壁の飾り）、scene は数で変わる物と家具。
 * 物は実際の数だけ描き、多くなったら積み上げる。
 */

type FloorKind = 'concrete' | 'wood' | 'tile';
const FLOOR: Record<Lane, FloorKind> = { dis: 'concrete', asm: 'wood', ship: 'tile' };

// ---------------------------------------------------------------- 部屋の土台

function drawSlabAndFloor(p: Iso, L: RoomLayout, pal: RoomPalette, kind: FloorKind): void {
  const { w, d, wallT: T, slab: S } = L;
  const g = p.g;
  // 台の下の柔らかい影
  const left = project(L.frame, 0, d, 0);
  const right = project(L.frame, w, 0, 0);
  const front = project(L.frame, w, d, 0);
  const rx = ((right.x - left.x) / 2) * 0.92;
  g.ellipse((left.x + right.x) / 2, front.y + 26, rx, 30).fill({ fill: softShadow() });

  const base = kind === 'concrete' ? pal.concrete : kind === 'wood' ? pal.wood : pal.tile;
  p.box(-T, -T, -S, w + T, d + T, S, { top: base, left: pal.slabLeft, right: pal.slabRight }, false);
  const rnd = visualRandom(kind === 'concrete' ? 11 : kind === 'wood' ? 23 : 37);
  if (kind === 'concrete') {
    // まだら模様と目地
    for (let i = 0; i < 26; i++) {
      const cx = 0.4 + rnd() * (w - 0.8);
      const cy = 0.4 + rnd() * (d - 0.8);
      const r = 0.3 + rnd() * 0.9;
      const c = project(L.frame, cx, cy, 0);
      g.ellipse(c.x, c.y, r * L.frame.u * 0.9, r * L.frame.u * 0.45).fill({
        color: pal.concreteSpot,
        alpha: 0.35 + rnd() * 0.25,
      });
    }
    for (const t of [w / 3, (2 * w) / 3]) p.flatRect(t - 0.015, 0, t + 0.015, d, 0, shade(pal.concrete, -0.1), 0.8);
    p.flatRect(0, d / 2 - 0.015, w, d / 2 + 0.015, 0, shade(pal.concrete, -0.1), 0.8);
  } else if (kind === 'wood') {
    // 板：列ごとに少し色を変え、継ぎ目をずらす
    const step = 0.9;
    let row = 0;
    for (let y = 0; y < d - 0.001; y += step, row++) {
      const y1 = Math.min(d, y + step);
      if (row % 2 === 1) p.flatRect(0, y, w, y1, 0, pal.woodAlt);
      p.flatRect(0, y1 - 0.025, w, y1, 0, pal.woodSeam, 0.7);
      let x = -((row * 1.7) % 3.1);
      while (x < w) {
        const len = 2.4 + ((row * 7 + Math.round(x * 3)) % 5) * 0.35;
        const xe = x + len;
        if (xe > 0 && xe < w) p.flatRect(xe - 0.02, y, xe + 0.02, y1, 0, pal.woodSeam, 0.8);
        x = xe;
      }
      // 木目
      for (let k = 0; k < 2; k++) {
        const gy = y + 0.25 + k * 0.35 + rnd() * 0.1;
        if (gy < y1 - 0.05) p.flatRect(rnd() * 3, gy, w - rnd() * 3, gy + 0.012, 0, shade(pal.wood, -0.08), 0.5);
      }
    }
  } else {
    // タイル：1枚ずつ少し色を変え、目地を入れる
    const n = 6;
    const sx = w / n;
    const sy = d / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i + j) % 2 === 1 || rnd() < 0.25) {
          p.flatRect(i * sx, j * sy, (i + 1) * sx, (j + 1) * sy, 0, rnd() < 0.5 ? pal.tileAlt : shade(pal.tile, -0.02));
        }
      }
    }
    for (let i = 1; i < n; i++) {
      p.flatRect(i * sx - 0.025, 0, i * sx + 0.025, d, 0, pal.tileGrout);
      p.flatRect(0, i * sy - 0.025, w, i * sy + 0.025, 0, pal.tileGrout);
    }
  }
  // 台の側面の明暗
  p.faceFill(
    [
      [-T, d, -S],
      [w, d, -S],
      [w, d, 0],
      [-T, d, 0],
    ],
    faceShade(),
  );
  p.faceFill(
    [
      [w, -T, -S],
      [w, d, -S],
      [w, d, 0],
      [w, -T, 0],
    ],
    faceShade(),
  );
  // 壁ぎわの陰（床に落ちる）
  p.faceFill(
    [
      [0, 0, 0],
      [w, 0, 0],
      [w, 0.9, 0],
      [0.9, 0.9, 0],
    ],
    floorFade(),
    0.9,
  );
  p.faceFill(
    [
      [0, 0, 0],
      [0.9, 0.9, 0],
      [0.9, d, 0],
      [0, d, 0],
    ],
    floorFade(),
    0.9,
  );
}

function drawWalls(p: Iso, L: RoomLayout, pal: RoomPalette): void {
  const { w, d, wallH: H, wallT: T } = L;
  // 右の壁（奥の角を含む）と左の壁
  p.box(-T, -T, 0, w + T, T, H, { top: pal.wallTop, left: pal.wallRight, right: pal.wallEnd }, false);
  p.faceFill(
    [
      [-T, 0, 0],
      [w, 0, 0],
      [w, 0, H],
      [-T, 0, H],
    ],
    faceShade(),
  );
  p.box(-T, 0, 0, T, d, H, { top: pal.wallTop, left: pal.wallEnd, right: pal.wallLeft }, false);
  p.faceFill(
    [
      [0, 0, 0],
      [0, d, 0],
      [0, d, H],
      [0, 0, H],
    ],
    faceShade(),
  );
  // 幅木
  p.planeY(0.004, 0, w, 0, 0.14, pal.baseboard);
  p.planeX(0.004, 0, d, 0, 0.14, shade(pal.baseboard, -0.06));
}

/** 窓（左の壁は x=0、右の壁は y=0 の面）と、床に落ちる光 */
function drawWindow(
  p: Iso,
  pal: RoomPalette,
  limit: number,
  wall: 'left' | 'right',
  a0: number,
  a1: number,
  z0: number,
  z1: number,
): void {
  const f = 0.1;
  const mid = (a0 + a1) / 2;
  const put = (b0: number, b1: number, c0: number, c1: number, color: number, alpha = 1) => {
    if (wall === 'left') p.planeX(0.01, b0, b1, c0, c1, color, alpha);
    else p.planeY(0.01, b0, b1, c0, c1, color, alpha);
  };
  // 床に落ちる光（窓の形を斜めに伸ばす）
  // 床の外にはみ出さないよう、奥へ伸びる分を部屋の中に収める
  const lim = (v: number) => Math.min(v, limit - 0.08);
  const pool: [number, number, number][] =
    wall === 'right'
      ? [
          [lim(a0 + 0.3), 0.2, 0],
          [lim(a1 + 0.3), 0.2, 0],
          [lim(a1 + 1.5), 2.9, 0],
          [lim(a0 + 1.5), 2.9, 0],
        ]
      : [
          [0.2, lim(a0 + 0.3), 0],
          [0.2, lim(a1 + 0.3), 0],
          [2.9, lim(a1 + 1.5), 0],
          [2.9, lim(a0 + 1.5), 0],
        ];
  p.face(pool, pal.sunlight, pal.sunlightAlpha * 0.35);
  p.faceFill(pool, sunFade(), pal.sunlightAlpha);
  if (pal.night) put(a0 - 0.35, a1 + 0.35, z0 - 0.3, z1 + 0.3, pal.glass, 0.14);
  put(a0 - 0.06, a1 + 0.06, z0 - 0.08, z0, shade(pal.windowFrame, -0.12));
  put(a0, a1, z0, z1, pal.windowFrame);
  put(a0 + f, mid - f / 2, z0 + f, z1 - f, pal.glass);
  put(mid + f / 2, a1 - f, z0 + f, z1 - f, pal.glass);
  // ガラスの反射
  if (!pal.night) {
    put(a0 + f + 0.1, a0 + f + 0.3, z0 + 0.35, z1 - f - 0.1, pal.glassShine, 0.8);
    put(mid + f / 2 + 0.1, mid + f / 2 + 0.25, z0 + 0.3, z1 - f - 0.15, pal.glassShine, 0.8);
  }
}

export function drawRoomShell(g: Graphics, lane: Lane, pal: RoomPalette): void {
  const L = ROOM_LAYOUT[lane];
  const p = new Iso(g, L.frame);
  drawSlabAndFloor(p, L, pal, FLOOR[lane]);
  drawWalls(p, L, pal);
  if (lane === 'dis') {
    drawWindow(p, pal, L.w, 'right', 7.0, 9.3, 1.05, 2.1);
    // 左の壁の有孔ボードと工具
    p.planeX(0.01, 1.7, 4.2, 1.0, 2.2, shade(pal.cork, 0.2));
    for (let i = 0; i < 5; i++) {
      const yy = 1.95 + i * 0.45;
      p.planeX(0.02, yy, yy + 0.07, 1.3 + (i % 2) * 0.1, 1.95, pal.metalDark.right);
      p.planeX(0.02, yy - 0.04, yy + 0.11, 1.18 + (i % 2) * 0.1, 1.32 + (i % 2) * 0.1, i % 2 === 0 ? 0xe0574a : 0x3552c4);
    }
    // 天井の明かり（夜）
    if (pal.night) p.lightPool(5, 5, 4.2, pal.lamp, 0.16);
  } else if (lane === 'asm') {
    drawWindow(p, pal, L.d, 'left', 2.0, 4.9, 1.05, 2.15);
    // ポスターと付せんのボード
    p.planeY(0.01, 8.35, 9.55, 1.15, 2.3, pal.poster);
    p.planeY(0.02, 8.47, 9.43, 1.27, 2.18, pal.posterInner);
    p.planeY(0.03, 8.62, 9.25, 1.45, 1.78, shade(pal.poster, 0.25));
    p.planeY(0.01, 1.2, 3.1, 1.25, 2.2, pal.night ? 0xc9d0dc : 0xffffff);
    const notes = [0xf6d365, 0x9be3b8, 0xf6a4a4, 0x8fb8ff];
    notes.forEach((c, i) =>
      p.planeY(0.02, 1.35 + (i % 2) * 0.85, 1.95 + (i % 2) * 0.85, 1.4 + Math.floor(i / 2) * 0.4, 1.72 + Math.floor(i / 2) * 0.4, c),
    );
  } else {
    // 玄関のドア・掲示板・左の壁の棚（たたんだ段ボール）
    const { x0, x1 } = SALES.door;
    if (pal.night) p.planeY(0.01, x0 - 0.4, x1 + 0.4, 0, 2.55, pal.door, 0.14);
    p.planeY(0.01, x0 - 0.08, x1 + 0.08, 0, 2.28, pal.doorFrame);
    p.planeY(0.02, x0 + 0.02, x1 - 0.02, 0, 2.18, pal.door);
    p.planeY(0.03, x0 + 0.2, x1 - 0.2, 1.35, 1.95, shade(pal.door, pal.night ? 0.2 : -0.06));
    p.planeY(0.03, x1 - 0.35, x1 - 0.22, 0.95, 1.07, shade(pal.door, -0.4));
    p.flatRect(x0 - 0.1, 0.05, x1 + 0.1, 0.9, 0.002, shade(pal.tile, -0.2));
    p.planeY(0.01, 0.8, 3.95, 1.35, 2.42, pal.cork);
    p.box(0.02, 4.4, 1.55, 0.5, 2.6, 0.06, pal.shelf);
    for (let i = 0; i < 4; i++) p.box(0.06, 4.55 + i * 0.6, 1.61, 0.4, 0.5, 0.05 + (i % 2) * 0.04, pal.cardboard, false);
  }
}

// ---------------------------------------------------------------- 数で変わる物

export interface SceneInfo {
  /** 描き直しが要るかを見分ける鍵 */
  key: string;
  draw(g: Graphics, pal: RoomPalette): void;
}

export interface SceneExtra {
  /** 廃棄箱に入れて見せる壊れた部品の数 */
  broken: number;
  /** 集荷を待つ梱包済みの箱の数 */
  boxesWaiting: number;
  /** 組み立て中のOSを入れる進み具合（モニターのバー） */
  installing: number;
}

/** 生産：ジャンクの棚・作業台・仕分け箱（余っている部品）・廃棄箱 */
function productionScene(s: GameState, L: RoomLayout, broken: number): SceneInfo {
  const sets = setsOf(s.parts);
  const spare = PART_TYPES.map((t) => s.parts[t] - sets);
  const shownBroken = Math.min(broken, 10);
  return {
    key: `dis|${s.junk}|${spare.join(',')}|${shownBroken}`,
    draw(g, pal) {
      const p = new Iso(g, L.frame);
      rack(p, pal, PRODUCTION.rack, s.junk);
      PART_TYPES.forEach((t, i) => {
        const [x, y] = PRODUCTION.bins[t];
        bin(p, pal, t, x, y, PRODUCTION.binSize, spare[i]!);
      });
      // 棚にのらないジャンクは床に積む
      const extra = Math.max(0, s.junk - 9);
      for (let n = 0; n < Math.min(extra, 12); n++) {
        const layer = Math.floor(n / 4);
        const i = n % 4;
        const x = 0.5 + (i % 2) * 1.25;
        const y = 2.0 + Math.floor(i / 2) * 0.95;
        if (layer === 0) p.shadow(x, y, 1.15, 0.82, 0, 0.1);
        junkPc(p, pal, x, y, layer * 0.56, n);
      }
      ewasteBin(p, pal, PRODUCTION.ewaste, shownBroken);
      bench(p, pal, PRODUCTION.bench);
      openBox(p, pal, 4.9, 7.5, 0, 1.15, 1.1, 0.66);
    },
  };
}

/** 制作：机（開けたPCケース・モニター・キーボード・ライト）・いす・ワゴン（そろった部品）・キット・観葉植物 */
function assemblyScene(s: GameState, L: RoomLayout, installing: number): SceneInfo {
  const sets = setsOf(s.parts);
  const kits = s.sub !== null ? s.sub.kits : 0;
  return {
    key: `asm|${sets}|${kits}|${Math.round(installing * 20)}`,
    draw(g, pal) {
      const p = new Iso(g, L.frame);
      const dsk = ASSEMBLY.desk;
      p.shadow(dsk.x, dsk.y, dsk.w, dsk.d, 0, 0.4);
      table(p, pal, dsk.x, dsk.y, dsk.w, dsk.d, dsk.top);
      // 開けたPCケース：中の基板が見える
      const [cx, cy] = ASSEMBLY.caseAt;
      p.shadow(cx, cy, 1.25, 1.2, dsk.top, 0.08);
      p.box(cx, cy, dsk.top, 1.25, 1.2, 1.5, pal.pc);
      const fy = cy + 1.2 + 0.004;
      p.planeY(fy, cx + 0.12, cx + 1.12, dsk.top + 0.14, dsk.top + 1.36, pal.part.board.right);
      p.planeY(fy + 0.001, cx + 0.24, cx + 0.62, dsk.top + 0.9, dsk.top + 1.24, pal.metal.right);
      p.planeY(fy + 0.001, cx + 0.72, cx + 0.8, dsk.top + 0.5, dsk.top + 1.24, pal.part.memory.right);
      p.planeY(fy + 0.001, cx + 0.86, cx + 0.94, dsk.top + 0.5, dsk.top + 1.24, pal.part.memory.right);
      p.planeY(fy + 0.001, cx + 0.2, cx + 1.02, dsk.top + 0.2, dsk.top + 0.4, pal.part.power.left);
      const [mx, my] = ASSEMBLY.monitorAt;
      monitor(p, pal, mx, my, dsk.top, installing);
      keyboard(p, pal, mx + 0.1, my + 0.95, dsk.top);
      deskLamp(p, pal, dsk.x + dsk.w - 0.55, dsk.y + 0.25, dsk.top);
      chair(p, pal, 5.1, 2.95);
      plant(p, pal, 9.05, 2.7);
      // 支給キット（下請け）
      const [kx, ky] = ASSEMBLY.kitAt;
      for (let i = 0; i < Math.min(kits, 6); i++) {
        kitBox(p, pal, kx + (i % 2) * 0.05, ky + Math.floor(i / 3) * 0.75, (i % 3) * 0.37);
      }
      cart(p, pal, ASSEMBLY.cart, sets);
    },
  };
}

/** 販売：注文票・梱包台・完成品・梱包済みの箱（梱包中と集荷待ち）・外の道路 */
function salesScene(s: GameState, L: RoomLayout, boxesWaiting: number): SceneInfo {
  const orders = s.orders.length;
  const pcs = s.pcs;
  let shipping = s.player.task?.lane === 'ship' ? 1 : 0;
  for (const w of s.workers) if (w.task?.lane === 'ship') shipping += 1;
  const boxes = shipping + boxesWaiting;
  return {
    key: `ship|${orders}|${pcs}|${boxes}`,
    draw(g, pal) {
      const p = new Iso(g, L.frame);
      orderBoard(p, pal, orders);
      packingTable(p, pal, SALES.table);
      const items: { x: number; y: number; z: number; kind: 'pc' | 'box' }[] = [];
      for (let i = 0; i < pcs; i++) {
        const slot = i % 9;
        const lift = Math.floor(i / 9) * 1.15;
        items.push({ x: SALES.pcs.x + (slot % 3) * 0.78, y: SALES.pcs.y + Math.floor(slot / 3) * 1.12, z: lift, kind: 'pc' });
      }
      for (let i = 0; i < Math.min(boxes, 12); i++) {
        const layer = Math.floor(i / 4);
        const j = i % 4;
        items.push({
          x: SALES.boxes.x + (j % 2) * 0.88,
          y: SALES.boxes.y + Math.floor(j / 2) * 0.88,
          z: layer * 0.62,
          kind: 'box',
        });
      }
      items.sort((a, b) => a.x + a.y - (b.x + b.y) || a.z - b.z);
      for (const it of items) {
        if (it.kind === 'pc') pcTower(p, pal, it.x, it.y, it.z);
        else packedBox(p, pal, it.x, it.y, it.z);
      }
      road(p, pal, SALES.road);
    },
  };
}

export function roomScene(lane: Lane, s: GameState, extra: SceneExtra): SceneInfo {
  const L = ROOM_LAYOUT[lane];
  if (lane === 'dis') return productionScene(s, L, extra.broken);
  if (lane === 'asm') return assemblyScene(s, L, extra.installing);
  return salesScene(s, L, extra.boxesWaiting);
}
