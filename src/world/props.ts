import type { PartType } from '../core/types';
import { faceShade, Iso, shade, type BoxColors } from './gfx';
import type { RoomPalette } from './palette';

/**
 * 部屋に置く物。すべてアイソメトリックの面で描く（文字は描かない）。
 * 座標はマス（x 右手前・y 左手前・z 上）。
 */

// ---------------------------------------------------------------- 部品（種類ごとに形を描き分ける）

/** 部品1個の大きさ（トレイ・箱・山に並べるとき） */
export const PART_SIZE: Record<PartType, { w: number; d: number; h: number }> = {
  board: { w: 0.62, d: 0.46, h: 0.07 },
  memory: { w: 0.66, d: 0.2, h: 0.09 },
  storage: { w: 0.44, d: 0.32, h: 0.09 },
  power: { w: 0.46, d: 0.42, h: 0.3 },
};

export function part(p: Iso, pal: RoomPalette, type: PartType, x: number, y: number, z: number, k = 1): void {
  const s = PART_SIZE[type];
  const w = s.w * k;
  const d = s.d * k;
  const h = s.h * k;
  const c = pal.part[type];
  if (type === 'board') {
    // 基板：緑の板、CPUの銀色、黒いチップ、金色の端子
    p.box(x, y, z, w, d, h, c, false);
    p.flatRect(x + w * 0.38, y + d * 0.28, x + w * 0.66, y + d * 0.66, z + h + 0.001, 0xc9d0d8);
    p.flatRect(x + w * 0.44, y + d * 0.36, x + w * 0.6, y + d * 0.58, z + h + 0.002, 0x8f99a6);
    p.flatRect(x + w * 0.08, y + d * 0.15, x + w * 0.24, y + d * 0.4, z + h + 0.001, 0x1f242c);
    p.flatRect(x + w * 0.08, y + d * 0.55, x + w * 0.3, y + d * 0.85, z + h + 0.001, 0x1f242c);
    p.flatRect(x + w * 0.74, y + d * 0.1, x + w * 0.8, y + d * 0.9, z + h + 0.001, pal.partMark.board);
  } else if (type === 'memory') {
    // メモリ：色つきの放熱板と金色の端子
    p.box(x, y, z, w, d, h, c, false);
    p.planeY(y + d + 0.002, x + w * 0.05, x + w * 0.95, z, z + h * 0.35, pal.partMark.storage);
    p.flatRect(x + w * 0.1, y + d * 0.3, x + w * 0.9, y + d * 0.7, z + h + 0.001, shade(c.top, 0.25));
  } else if (type === 'storage') {
    // SSD：黒い箱と黄色のラベル
    p.box(x, y, z, w, d, h, c, false);
    p.flatRect(x + w * 0.15, y + d * 0.2, x + w * 0.85, y + d * 0.75, z + h + 0.001, pal.partMark.storage);
    p.flatRect(x + w * 0.2, y + d * 0.28, x + w * 0.5, y + d * 0.42, z + h + 0.002, shade(pal.partMark.storage, -0.35));
  } else {
    // 電源：銀色の箱、上にファンの網、黒い線
    p.box(x, y, z, w, d, h, c, true);
    const cx = x + w / 2;
    const cy = y + d / 2;
    const r = Math.min(w, d) * 0.34;
    p.face(
      [
        [cx - r, cy - r, z + h + 0.001],
        [cx + r, cy - r, z + h + 0.001],
        [cx + r, cy + r, z + h + 0.001],
        [cx - r, cy + r, z + h + 0.001],
      ],
      pal.partMark.power,
    );
    p.face(
      [
        [cx - r * 0.35, cy - r * 0.35, z + h + 0.002],
        [cx + r * 0.35, cy - r * 0.35, z + h + 0.002],
        [cx + r * 0.35, cy + r * 0.35, z + h + 0.002],
        [cx - r * 0.35, cy + r * 0.35, z + h + 0.002],
      ],
      shade(pal.partMark.power, 0.4),
    );
    p.planeY(y + d + 0.002, x + w * 0.6, x + w * 0.72, z + h * 0.1, z + h * 0.45, 0x15191f);
  }
}

// ---------------------------------------------------------------- 生産の部屋

/** 横に寝かせた古いデスクトップPC（ジャンク）。前面にドライブ口と電源ボタン、横に通気口 */
export function junkPc(p: Iso, pal: RoomPalette, x: number, y: number, z: number, variant = 0): void {
  const w = 1.15;
  const d = 0.82;
  const h = 0.56;
  const tone = variant % 3 === 1 ? shade(pal.junk.right, -0.08) : variant % 3 === 2 ? shade(pal.junk.right, 0.06) : pal.junk.right;
  const c: BoxColors = { top: shade(tone, 0.14), left: shade(tone, -0.18), right: tone };
  p.box(x, y, z, w, d, h, c);
  // 前面（左の面）：ドライブ口・電源ボタン
  const fy = y + d + 0.004;
  p.planeY(fy, x + 0.1, x + 0.72, z + 0.3, z + 0.44, pal.junkPanel);
  p.planeY(fy + 0.001, x + 0.14, x + 0.68, z + 0.35, z + 0.38, pal.junkDark);
  p.planeY(fy, x + 0.1, x + 0.72, z + 0.12, z + 0.24, pal.junkPanel);
  p.planeY(fy + 0.001, x + 0.14, x + 0.68, z + 0.17, z + 0.2, pal.junkDark);
  p.planeY(fy, x + 0.88, x + 0.98, z + 0.3, z + 0.4, 0x7fd6a4);
  // 横（右の面）：通気口
  const fx = x + w + 0.004;
  for (let i = 0; i < 3; i++) p.planeX(fx, y + 0.15, y + 0.62, z + 0.14 + i * 0.1, z + 0.17 + i * 0.1, pal.junkDark);
  // 上の汚れ・ラベル
  p.flatRect(x + 0.2, y + 0.2, x + 0.45, y + 0.38, z + h + 0.001, shade(c.top, -0.12), 0.7);
  p.flatRect(x + 0.7, y + 0.45, x + 0.98, y + 0.62, z + h + 0.001, 0xf2d06b, 0.9);
}

export function rack(
  p: Iso,
  pal: RoomPalette,
  r: { x0: number; x1: number; y0: number; y1: number; shelvesZ: number[] },
  junk: number,
): void {
  const post = 0.09;
  const H = 2.55;
  p.box(r.x0, r.y0, 0, post, post, H, pal.metalDark);
  p.box(r.x1 - post, r.y0, 0, post, post, H, pal.metalDark);
  const onRack = Math.min(junk, 9);
  r.shelvesZ.forEach((z, k) => {
    p.box(r.x0, r.y0, z, r.x1 - r.x0, r.y1 - r.y0, 0.06, pal.shelf);
    p.planeY(r.y1 + 0.003, r.x0, r.x1, z, z + 0.06, shade(pal.shelf.left, -0.1));
    // 作業台に近い右の端から並べる
    for (let i = 2; i >= 0; i--) {
      const n = k * 3 + (2 - i);
      if (n < onRack) {
        p.shadow(r.x0 + 0.18 + i * 1.3, r.y0 + 0.14, 1.15, 0.82, z + 0.06, 0.05);
        junkPc(p, pal, r.x0 + 0.18 + i * 1.3, r.y0 + 0.14, z + 0.06, n);
      }
    }
  });
  p.box(r.x0, r.y1 - post, 0, post, post, H, pal.metalDark);
  p.box(r.x1 - post, r.y1 - post, 0, post, post, H, pal.metalDark);
}

/** 作業台：木の天板、帯電防止マット、開けたジャンクPC（中の基板・メモリ・ファン）、ドライバー */
export function bench(p: Iso, pal: RoomPalette, b: { x: number; y: number; w: number; d: number; top: number }): void {
  const { x, y, w, d, top } = b;
  p.shadow(x, y, w, d, 0, 0.45);
  table(p, pal, x, y, w, d, top);
  // 下の棚
  p.box(x + 0.15, y + 0.15, 0.25, w - 0.3, d - 0.3, 0.05, pal.furnitureLeg);
  // マット
  p.flatRect(x + 0.15, y + 0.12, x + w - 0.15, y + d - 0.12, top + 0.001, pal.mat);
  for (let i = 1; i < 6; i++) {
    const gx = x + 0.15 + ((w - 0.3) * i) / 6;
    p.flatRect(gx - 0.01, y + 0.12, gx + 0.01, y + d - 0.12, top + 0.002, pal.matLine, 0.8);
  }
  // 開けたPCケース（上が開いている）
  const cx = x + 0.4;
  const cy = y + 0.3;
  const cw = 1.6;
  const cd = 0.95;
  const ch = 0.42;
  p.shadow(cx, cy, cw, cd, top, 0.05);
  p.box(cx, cy, top, cw, cd, ch, { ...pal.junk, top: shade(pal.junk.left, -0.15) });
  p.flatRect(cx + 0.08, cy + 0.08, cx + cw - 0.08, cy + cd - 0.08, top + 0.1, pal.part.board.right);
  part(p, pal, 'memory', cx + 0.2, cy + 0.2, top + 0.1, 0.9);
  part(p, pal, 'memory', cx + 0.2, cy + 0.42, top + 0.1, 0.9);
  // CPUのファン
  p.box(cx + 0.95, cy + 0.25, top + 0.1, 0.42, 0.42, 0.22, pal.metal);
  p.flatRect(cx + 1.0, cy + 0.3, cx + 1.32, cy + 0.62, top + 0.321, shade(pal.metal.left, -0.2));
  // ドライバーとねじ
  p.box(x + w - 0.95, y + d - 0.45, top, 0.55, 0.06, 0.05, { top: 0xcfd6de, left: 0x8f99a6, right: 0xaab4c1 });
  p.box(x + w - 0.45, y + d - 0.47, top, 0.26, 0.1, 0.09, { top: 0xe0574a, left: 0xa83b30, right: 0xc9473b });
  for (let i = 0; i < 3; i++) p.flatRect(x + w - 1.2 + i * 0.12, y + d - 0.28, x + w - 1.14 + i * 0.12, y + d - 0.22, top + 0.003, 0xc9d0d8);
}

/** 仕分け箱（部品の種類ごと）。前にその種類の色の札、中に部品を数だけ積む */
export function bin(
  p: Iso,
  pal: RoomPalette,
  type: PartType,
  x: number,
  y: number,
  size: { w: number; d: number; h: number },
  count: number,
): void {
  const { w, d, h } = size;
  p.shadow(x, y, w, d, 0, 0.15);
  // 奥の内側の壁
  p.planeY(y + 0.06, x + 0.06, x + w - 0.06, 0.06, h, shade(pal.bin.left, -0.25));
  p.planeX(x + 0.06, y + 0.06, y + d - 0.06, 0.06, h, shade(pal.bin.right, -0.2));
  p.flatRect(x + 0.06, y + 0.06, x + w - 0.06, y + d - 0.06, 0.06, shade(pal.bin.left, -0.3));
  // 中の部品（下から積む。多いときは箱からはみ出して山になる）
  const s = PART_SIZE[type];
  const perLayer = type === 'power' ? 2 : type === 'memory' ? 3 : 2;
  const shown = Math.min(count, 14);
  for (let i = 0; i < shown; i++) {
    const layer = Math.floor(i / perLayer);
    const j = i % perLayer;
    const px = x + 0.12 + ((j * 0.37) % Math.max(0.1, w - s.w - 0.18)) + (layer % 2) * 0.05;
    const py = y + 0.14 + (type === 'memory' ? j * 0.24 : (layer % 2) * 0.1);
    const pz = 0.08 + layer * (s.h + 0.02);
    part(p, pal, type, px, py, pz);
  }
  // 手前と横の壁（中身より手前）
  p.planeY(y + d, x, x + w, 0, h, pal.bin.left);
  p.faceFill(
    [
      [x, y + d, 0],
      [x + w, y + d, 0],
      [x + w, y + d, h],
      [x, y + d, h],
    ],
    faceShade(),
  );
  p.planeX(x + w, y, y + d, 0, h, pal.bin.right);
  p.flatRect(x, y + d - 0.06, x + w, y + d, h, pal.bin.top);
  p.flatRect(x + w - 0.06, y, x + w, y + d, h, pal.bin.top);
  // 種類の札
  p.planeY(y + d + 0.004, x + 0.2, x + w - 0.2, h * 0.3, h * 0.72, pal.part[type].right);
}

/** 廃棄箱（壊れた部品）。赤い箱に、壊れた部品を数だけ（上限あり）入れる */
export function ewasteBin(
  p: Iso,
  pal: RoomPalette,
  e: { x: number; y: number; w: number; d: number; h: number },
  broken: number,
): void {
  const { x, y, w, d, h } = e;
  p.shadow(x, y, w, d, 0, 0.18);
  p.planeY(y + 0.06, x + 0.06, x + w - 0.06, 0.06, h, shade(pal.ewaste.left, -0.3));
  p.planeX(x + 0.06, y + 0.06, y + d - 0.06, 0.06, h, shade(pal.ewaste.right, -0.3));
  const shown = Math.min(broken, 10);
  const types: PartType[] = ['board', 'memory', 'storage', 'power'];
  for (let i = 0; i < shown; i++) {
    const t = types[(i * 3 + 1) % 4]!;
    const px = x + 0.15 + ((i * 0.23) % 0.4);
    const py = y + 0.15 + ((i * 0.37) % 0.45);
    part(p, { ...pal, part: { ...pal.part, [t]: { top: 0x6b6e73, left: 0x44474c, right: 0x575a60 } } }, t, px, py, 0.08 + Math.floor(i / 3) * 0.1, 0.8);
  }
  p.planeY(y + d, x, x + w, 0, h, pal.ewaste.left);
  p.planeX(x + w, y, y + d, 0, h, pal.ewaste.right);
  p.flatRect(x, y + d - 0.06, x + w, y + d, h, pal.ewaste.top);
  p.flatRect(x + w - 0.06, y, x + w, y + d, h, pal.ewaste.top);
  // 白い帯（捨てる箱の印）
  p.planeY(y + d + 0.004, x + 0.12, x + w - 0.12, h * 0.45, h * 0.62, 0xffffff, 0.85);
}

/** 届いた段ボール（開いている） */
export function openBox(p: Iso, pal: RoomPalette, x: number, y: number, z: number, w: number, d: number, h: number): void {
  p.shadow(x, y, w, d, z, 0.15);
  p.box(x, y, z, w, d, h, { ...pal.cardboard, top: pal.cardboardInner });
  const r = 0.08;
  p.flatRect(x, y + d - r, x + w, y + d, z + h, pal.cardboard.top);
  p.flatRect(x + w - r, y, x + w, y + d, z + h, pal.cardboard.top);
  p.planeX(x + r, y + r, y + d - r, z + h - 0.25, z + h, shade(pal.cardboardInner, 0.12));
  // ふた（開いて外へ倒れている）
  p.face(
    [
      [x, y + d, z + h],
      [x + w, y + d, z + h],
      [x + w, y + d + 0.35, z + h - 0.2],
      [x, y + d + 0.35, z + h - 0.2],
    ],
    shade(pal.cardboard.top, -0.05),
  );
}

// ---------------------------------------------------------------- 家具

export function table(p: Iso, pal: RoomPalette, x: number, y: number, w: number, d: number, top: number): void {
  const leg = 0.13;
  const legH = top - 0.12;
  p.box(x + 0.08, y + 0.08, 0, leg, leg, legH, pal.furnitureLeg);
  p.box(x + w - 0.08 - leg, y + 0.08, 0, leg, leg, legH, pal.furnitureLeg);
  p.box(x + 0.08, y + d - 0.08 - leg, 0, leg, leg, legH, pal.furnitureLeg);
  p.box(x + w - 0.08 - leg, y + d - 0.08 - leg, 0, leg, leg, legH, pal.furnitureLeg);
  p.box(x, y, top - 0.12, w, d, 0.12, pal.furniture);
  // 木目
  for (let i = 1; i < 4; i++) {
    const gy = y + (d * i) / 4;
    p.flatRect(x + 0.05, gy - 0.008, x + w - 0.05, gy + 0.008, top + 0.0005, shade(pal.furniture.top, -0.07), 0.8);
  }
}

export function chair(p: Iso, pal: RoomPalette, x: number, y: number): void {
  p.shadow(x, y, 0.95, 0.9, 0, 0.2);
  // 足（五本脚の代わりに十字）
  p.box(x + 0.1, y + 0.4, 0, 0.75, 0.1, 0.06, pal.chair);
  p.box(x + 0.42, y + 0.08, 0, 0.1, 0.75, 0.06, pal.chair);
  p.box(x + 0.42, y + 0.4, 0.06, 0.1, 0.1, 0.44, pal.metalDark);
  p.box(x, y, 0.5, 0.95, 0.9, 0.13, pal.chair);
  p.box(x, y + 0.78, 0.63, 0.95, 0.12, 0.85, pal.chair);
}

/** モニター：画面にOSを入れている様子（進み具合のバー） */
export function monitor(p: Iso, pal: RoomPalette, x: number, y: number, z: number, progress: number): void {
  p.box(x + 0.7, y + 0.28, z, 0.36, 0.3, 0.06, pal.bezel);
  p.box(x + 0.83, y + 0.33, z + 0.06, 0.1, 0.1, 0.3, pal.bezel);
  p.box(x, y, z + 0.3, 1.8, 0.13, 1.08, pal.bezel);
  const sy = y + 0.13 + 0.004;
  if (pal.screenGlow) p.planeY(sy + 0.25, x - 0.35, x + 2.15, z + 0.1, z + 1.6, pal.screen, 0.12);
  p.planeY(sy, x + 0.08, x + 1.72, z + 0.38, z + 1.3, pal.screen);
  // 画面の中：窓とバー
  p.planeY(sy + 0.001, x + 0.4, x + 1.4, z + 0.75, z + 1.12, shade(pal.screen, 0.25));
  p.planeY(sy + 0.002, x + 0.5, x + 1.3, z + 0.84, z + 0.9, shade(pal.screen, -0.25));
  const k = Math.max(0, Math.min(1, progress));
  if (k > 0) p.planeY(sy + 0.003, x + 0.5, x + 0.5 + 0.8 * k, z + 0.84, z + 0.9, pal.screenBar);
}

export function keyboard(p: Iso, pal: RoomPalette, x: number, y: number, z: number): void {
  p.box(x, y, z, 1.25, 0.42, 0.06, pal.bezel);
  for (let r = 0; r < 3; r++) {
    p.flatRect(x + 0.08, y + 0.08 + r * 0.11, x + 1.17, y + 0.14 + r * 0.11, z + 0.061, shade(pal.bezel.top, 0.18), 0.9);
  }
  p.box(x + 1.4, y + 0.1, z, 0.2, 0.3, 0.07, pal.bezel);
}

/** 机のライト。夜は光だまりを作る */
export function deskLamp(p: Iso, pal: RoomPalette, x: number, y: number, z: number): void {
  if (pal.night) p.lightPool(x + 0.3, y + 1.1, 2.4, pal.lamp, pal.lampAlpha);
  p.box(x, y, z, 0.36, 0.36, 0.06, pal.metalDark);
  p.box(x + 0.14, y + 0.14, z + 0.06, 0.08, 0.08, 0.75, pal.metalDark);
  p.box(x - 0.05, y + 0.1, z + 0.78, 0.46, 0.34, 0.18, pal.metal);
  if (pal.night) p.flatRect(x, y + 0.14, x + 0.36, y + 0.4, z + 0.779, pal.lamp);
}

export function plant(p: Iso, pal: RoomPalette, x: number, y: number): void {
  p.shadow(x, y, 0.6, 0.6, 0, 0.2);
  p.box(x, y, 0, 0.6, 0.6, 0.55, pal.plantPot);
  const leaves: [number, number, number, number][] = [
    [0.05, 0.05, 0.55, 0.5],
    [0.2, -0.1, 0.9, 0.45],
    [-0.1, 0.25, 0.85, 0.4],
    [0.25, 0.25, 1.25, 0.35],
  ];
  for (const [dx, dy, dz, s] of leaves) {
    p.box(x + dx, y + dy, dz, s, s, 0.28, { top: pal.plant, left: pal.plantDark, right: shade(pal.plant, -0.08) }, false);
  }
}

/** 完成した再生PC（黒いタワー、前面に青い光の線と電源ランプ、横にガラス窓） */
export function pcTower(p: Iso, pal: RoomPalette, x: number, y: number, z: number): void {
  const w = 0.6;
  const d = 0.95;
  const h = 1.15;
  p.shadow(x, y, w, d, z, 0.12);
  p.box(x, y, z, w, d, h, pal.pc);
  const fy = y + d + 0.004;
  p.planeY(fy, x + 0.08, x + 0.14, z + 0.12, z + h - 0.12, pal.pcAccent, pal.night ? 1 : 0.85);
  p.planeY(fy, x + 0.4, x + 0.5, z + h - 0.2, z + h - 0.12, pal.led);
  const fx = x + w + 0.004;
  p.planeX(fx, y + 0.12, y + d - 0.12, z + 0.18, z + h - 0.15, shade(pal.pc.right, 0.12));
  p.planeX(fx + 0.001, y + 0.2, y + 0.55, z + 0.3, z + 0.55, pal.part.board.right, 0.8);
  p.planeX(fx + 0.001, y + 0.62, y + d - 0.2, z + 0.62, z + 0.95, pal.night ? 0x7fb8ff : 0x5a86c8, 0.7);
}

/** 1台分そろった部品を載せたトレイ */
export function tray(p: Iso, pal: RoomPalette, x: number, y: number, z: number): void {
  p.box(x, y, z, 1.0, 0.7, 0.06, pal.tray);
  part(p, pal, 'board', x + 0.05, y + 0.06, z + 0.06, 0.62);
  part(p, pal, 'memory', x + 0.5, y + 0.06, z + 0.06, 0.62);
  part(p, pal, 'storage', x + 0.5, y + 0.28, z + 0.06, 0.8);
  part(p, pal, 'power', x + 0.08, y + 0.38, z + 0.06, 0.62);
}

/** ワゴン（2段）。そろった部品のトレイを数だけ載せ、多いときは床に積む */
export function cart(p: Iso, pal: RoomPalette, c: { x: number; y: number; w: number; d: number }, sets: number): void {
  const { x, y, w, d } = c;
  p.shadow(x, y, w, d, 0, 0.3);
  const post = 0.07;
  const levels = [0.18, 0.78];
  for (const [px, py] of [
    [x, y],
    [x + w - post, y],
  ] as const)
    p.box(px, py, 0.08, post, post, 1.2, pal.cart);
  // 車輪
  for (const [px, py] of [
    [x + 0.05, y + d - 0.12],
    [x + w - 0.15, y + d - 0.12],
    [x + w - 0.15, y + 0.05],
  ] as const)
    p.box(px, py, 0, 0.1, 0.1, 0.08, { top: 0x2a2f36, left: 0x15191f, right: 0x1f242a });
  let n = 0;
  for (const z of levels) {
    p.box(x, y, z, w, d, 0.05, pal.cart);
    for (let i = 0; i < 2 && n < sets; i++, n++) tray(p, pal, x + 0.12 + i * 1.12, y + 0.24, z + 0.05);
  }
  for (const [px, py] of [
    [x, y + d - post],
    [x + w - post, y + d - post],
  ] as const)
    p.box(px, py, 0.08, post, post, 1.2, pal.cart);
  // あふれた分は床に積む
  for (let i = 0; n < sets && i < 12; i++, n++) {
    const layer = Math.floor(i / 2);
    tray(p, pal, x - 1.25 + (i % 2) * 0.1, y + 0.2 + (i % 2) * 0.85, layer * 0.14);
  }
}

export function kitBox(p: Iso, pal: RoomPalette, x: number, y: number, z: number): void {
  p.shadow(x, y, 0.86, 0.66, z, 0.08);
  p.box(x, y, z, 0.86, 0.66, 0.36, pal.kit);
  p.flatRect(x + 0.1, y + 0.26, x + 0.76, y + 0.4, z + 0.361, shade(pal.kit.top, 0.3));
  p.planeY(y + 0.664, x + 0.12, x + 0.4, z + 0.1, z + 0.26, 0xffffff, 0.85);
}

// ---------------------------------------------------------------- 販売の部屋

/** 梱包済みの箱（ガムテープとラベル） */
export function packedBox(p: Iso, pal: RoomPalette, x: number, y: number, z: number): void {
  const s = 0.82;
  const h = 0.62;
  p.shadow(x, y, s, s, z, 0.08);
  p.box(x, y, z, s, s, h, pal.cardboard);
  p.flatRect(x + s / 2 - 0.09, y, x + s / 2 + 0.09, y + s, z + h + 0.001, pal.tape);
  p.planeY(y + s + 0.004, x + s / 2 - 0.09, x + s / 2 + 0.09, z + h - 0.25, z + h, pal.tape);
  p.planeX(x + s + 0.004, y + 0.15, y + 0.5, z + 0.18, z + 0.42, pal.label);
  p.planeX(x + s + 0.005, y + 0.2, y + 0.45, z + 0.24, z + 0.27, 0x1f2a37, 0.8);
}

export function packingTable(p: Iso, pal: RoomPalette, t: { x: number; y: number; w: number; d: number; top: number }): void {
  const { x, y, w, d, top } = t;
  p.shadow(x, y, w, d, 0, 0.45);
  table(p, pal, x, y, w, d, top);
  // ラベルプリンター（出てきたラベル）
  p.box(x + 0.55, y + 0.25, top, 0.62, 0.55, 0.3, pal.printer);
  p.flatRect(x + 0.67, y + 0.36, x + 1.05, y + 0.68, top + 0.301, shade(pal.printer.top, -0.2));
  p.face(
    [
      [x + 0.7, y + 0.8, top + 0.18],
      [x + 1.02, y + 0.8, top + 0.18],
      [x + 1.02, y + 1.02, top + 0.02],
      [x + 0.7, y + 1.02, top + 0.02],
    ],
    pal.label,
  );
  // 開いた段ボール
  openBox(p, pal, x + 1.75, y + 0.2, top, 1.2, 1.05, 0.55);
  // ガムテープ
  p.box(x + 3.1, y + 0.3, top, 0.34, 0.34, 0.14, { top: 0xe0cc9e, left: 0xb39f70, right: 0xc9b584 });
  p.flatRect(x + 3.19, y + 0.39, x + 3.35, y + 0.55, top + 0.141, 0x8a7a55);
  // スマホ（フリマの画面）
  p.flatRect(x + 0.2, y + 1.0, x + 0.68, y + 1.42, top + 0.001, pal.phone);
  p.flatRect(x + 0.25, y + 1.05, x + 0.63, y + 1.37, top + 0.002, pal.phoneScreen);
  p.flatRect(x + 0.3, y + 1.1, x + 0.58, y + 1.18, top + 0.003, 0xe0574a);
  p.flatRect(x + 0.3, y + 1.22, x + 0.5, y + 1.3, top + 0.003, 0xffffff, 0.9);
}

/** 注文票の掲示板（右の壁）。待っている注文の数だけ貼る */
export function orderBoard(p: Iso, pal: RoomPalette, orders: number): void {
  for (let i = 0; i < Math.min(orders, 12); i++) {
    const col = i % 4;
    const row = Math.floor(i / 4) % 2;
    const layer = Math.floor(i / 8);
    const x = 1.0 + col * 0.72 + layer * 0.18;
    const z = 2.08 - row * 0.5 - layer * 0.08;
    p.planeY(0.02, x + 0.02, x + 0.58, z - 0.34, z - 0.02, shade(pal.slip, -0.2), 0.5);
    p.planeY(0.025, x, x + 0.56, z - 0.32, z, pal.slip);
    p.planeY(0.03, x + 0.24, x + 0.32, z - 0.06, z + 0.02, pal.pin);
    p.planeY(0.03, x + 0.08, x + 0.48, z - 0.16, z - 0.13, shade(pal.slip, -0.35));
    p.planeY(0.03, x + 0.08, x + 0.36, z - 0.24, z - 0.21, shade(pal.slip, -0.35));
  }
}

/** 外の道路 */
export function road(p: Iso, pal: RoomPalette, r: { x0: number; x1: number; y0: number; y1: number; z: number }): void {
  p.box(r.x0 - 0.35, r.y0, r.z - 0.45, 0.35, r.y1 - r.y0, 0.52, pal.curb);
  p.box(r.x0, r.y0, r.z - 0.45, r.x1 - r.x0, r.y1 - r.y0, 0.45, pal.road);
  for (let y = r.y0 + 0.6; y < r.y1 - 0.4; y += 1.5) {
    p.flatRect(r.x0 + 1.1, y, r.x0 + 1.3, y + 0.7, r.z + 0.001, pal.roadLine);
  }
}

/** 集荷のバン。y を動かすと道路の上を走る */
export function van(p: Iso, pal: RoomPalette, vx: number, vy: number, base: number): void {
  const vw = 1.6;
  p.shadow(vx, vy, vw, 3.95, base, 0.2);
  // 車輪
  for (const ty of [vy + 0.5, vy + 3.2]) p.box(vx + vw - 0.02, ty, base, 0.06, 0.5, 0.32, { top: pal.tire, left: pal.tire, right: pal.tire }, false);
  // 荷台
  p.box(vx, vy, base + 0.12, vw, 3.0, 1.38, pal.van);
  p.face(
    [
      [vx + vw + 0.005, vy + 0.35, base + 0.45],
      [vx + vw + 0.005, vy + 2.75, base + 0.85],
      [vx + vw + 0.005, vy + 2.75, base + 1.0],
      [vx + vw + 0.005, vy + 0.35, base + 0.6],
    ],
    pal.vanStripe,
  );
  // 運転席
  p.box(vx, vy + 3.0, base + 0.12, vw, 0.95, 0.98, pal.van);
  p.face(
    [
      [vx + 0.14, vy + 3.95 + 0.005, base + 0.62],
      [vx + vw - 0.14, vy + 3.95 + 0.005, base + 0.62],
      [vx + vw - 0.14, vy + 3.95 + 0.005, base + 1.02],
      [vx + 0.14, vy + 3.95 + 0.005, base + 1.02],
    ],
    pal.vanWindow,
  );
  p.face(
    [
      [vx + vw + 0.005, vy + 3.1, base + 0.62],
      [vx + vw + 0.005, vy + 3.8, base + 0.62],
      [vx + vw + 0.005, vy + 3.8, base + 0.98],
      [vx + vw + 0.005, vy + 3.1, base + 0.98],
    ],
    pal.vanWindow,
  );
  // ライト
  p.planeY(vy + 3.95 + 0.006, vx + 0.1, vx + 0.35, base + 0.3, base + 0.42, pal.night ? 0xfff2b0 : 0xf4f6f8);
  p.planeY(vy + 3.95 + 0.006, vx + vw - 0.35, vx + vw - 0.1, base + 0.3, base + 0.42, pal.night ? 0xfff2b0 : 0xf4f6f8);
}
