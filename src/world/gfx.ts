import { FillGradient, type Graphics } from 'pixi.js';
import { project, type IsoFrame } from './isoMath';

/**
 * 写実寄りの描き方の道具：柔らかい影、面の明暗のグラデーション、縁のハイライト。
 * グラデーションは形ごとの範囲（local）で塗るので、同じものを使い回せる。
 */

export interface BoxColors {
  top: number;
  left: number;
  right: number;
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** 色を明るく（amount>0）・暗く（amount<0）する */
export function shade(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))));
  return (f(r) << 16) | (f(g) << 8) | f(b);
}

/** 2色を混ぜる */
export function mix(a: number, b: number, t: number): number {
  const k = clamp01(t);
  const ch = (s: number) => Math.round(((a >> s) & 0xff) * (1 - k) + ((b >> s) & 0xff) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** 1色から箱の3面の色を作る（上が明るく、左が暗い） */
export function boxOf(base: number, topLift = 0.2, leftDrop = -0.16): BoxColors {
  return { top: shade(base, topLift), left: shade(base, leftDrop), right: base };
}

let softShadowFill: FillGradient | null = null;
let faceShadeFill: FillGradient | null = null;
let floorFadeFill: FillGradient | null = null;
let glowFill: FillGradient | null = null;

/** 足元の柔らかい影（中心が濃く、外へ消える） */
export function softShadow(): FillGradient {
  softShadowFill ??= new FillGradient({
    type: 'radial',
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.5,
    colorStops: [
      { offset: 0, color: 'rgba(20,28,40,0.34)' },
      { offset: 0.55, color: 'rgba(20,28,40,0.16)' },
      { offset: 1, color: 'rgba(20,28,40,0)' },
    ],
    textureSpace: 'local',
  });
  return softShadowFill;
}

/** 立っている面の明暗（上がわずかに明るく、下が暗い） */
export function faceShade(): FillGradient {
  faceShadeFill ??= new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: 'rgba(255,255,255,0.10)' },
      { offset: 0.5, color: 'rgba(255,255,255,0)' },
      { offset: 1, color: 'rgba(0,0,0,0.16)' },
    ],
    textureSpace: 'local',
  });
  return faceShadeFill;
}

/** 床の陰（上＝壁ぎわが濃く、下へ消える） */
export function floorFade(): FillGradient {
  floorFadeFill ??= new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: 'rgba(0,0,0,0.20)' },
      { offset: 1, color: 'rgba(0,0,0,0)' },
    ],
    textureSpace: 'local',
  });
  return floorFadeFill;
}

let sunFadeFill: FillGradient | null = null;

/** 窓から床に落ちる光（窓ぎわが明るく、奥へ消える） */
export function sunFade(): FillGradient {
  sunFadeFill ??= new FillGradient({
    type: 'linear',
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
    colorStops: [
      { offset: 0, color: 'rgba(255,248,222,0.55)' },
      { offset: 1, color: 'rgba(255,248,222,0)' },
    ],
    textureSpace: 'local',
  });
  return sunFadeFill;
}

/** 明かりの光だまり（中心が明るく、外へ消える。色は alpha で重ねる） */
export function glow(): FillGradient {
  glowFill ??= new FillGradient({
    type: 'radial',
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.5,
    colorStops: [
      { offset: 0, color: 'rgba(255,255,255,1)' },
      { offset: 0.45, color: 'rgba(255,255,255,0.45)' },
      { offset: 1, color: 'rgba(255,255,255,0)' },
    ],
    textureSpace: 'local',
  });
  return glowFill;
}

/** 見た目だけに使う決まった並びの乱数（毎回同じ模様にするため） */
export function visualRandom(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type P3 = [number, number, number];

/** アイソメトリックの面を塗る道具 */
export class Iso {
  constructor(
    public g: Graphics,
    public f: IsoFrame,
  ) {}

  flat(points: P3[]): number[] {
    const out: number[] = [];
    for (const [x, y, z] of points) {
      const p = project(this.f, x, y, z);
      out.push(p.x, p.y);
    }
    return out;
  }

  face(points: P3[], color: number, alpha = 1): this {
    this.g.poly(this.flat(points)).fill({ color, alpha });
    return this;
  }

  faceFill(points: P3[], fill: FillGradient, alpha = 1): this {
    this.g.poly(this.flat(points)).fill({ fill, alpha });
    return this;
  }

  flatRect(x0: number, y0: number, x1: number, y1: number, z: number, color: number, alpha = 1): this {
    return this.face(
      [
        [x0, y0, z],
        [x1, y0, z],
        [x1, y1, z],
        [x0, y1, z],
      ],
      color,
      alpha,
    );
  }

  /** x が一定の面（左の壁・箱の右の面） */
  planeX(x: number, y0: number, y1: number, z0: number, z1: number, color: number, alpha = 1): this {
    return this.face(
      [
        [x, y0, z0],
        [x, y1, z0],
        [x, y1, z1],
        [x, y0, z1],
      ],
      color,
      alpha,
    );
  }

  /** y が一定の面（右の壁・箱の左の面） */
  planeY(y: number, x0: number, x1: number, z0: number, z1: number, color: number, alpha = 1): this {
    return this.face(
      [
        [x0, y, z0],
        [x1, y, z0],
        [x1, y, z1],
        [x0, y, z1],
      ],
      color,
      alpha,
    );
  }

  /** 見える3面（上・左・右）を塗った箱。shaded なら立つ面に明暗、top の手前の縁にハイライト */
  box(x: number, y: number, z: number, w: number, d: number, h: number, c: BoxColors, shaded = true): this {
    const left: P3[] = [
      [x, y + d, z],
      [x + w, y + d, z],
      [x + w, y + d, z + h],
      [x, y + d, z + h],
    ];
    const right: P3[] = [
      [x + w, y, z],
      [x + w, y + d, z],
      [x + w, y + d, z + h],
      [x + w, y, z + h],
    ];
    this.face(left, c.left);
    this.face(right, c.right);
    if (shaded && h > 0.25) {
      this.faceFill(left, faceShade());
      this.faceFill(right, faceShade());
    }
    this.flatRect(x, y, x + w, y + d, z + h, c.top);
    if (shaded) {
      // 上の面の手前の縁を少し明るく（角の丸み）
      const e = Math.min(0.06, w * 0.2, d * 0.2);
      this.face(
        [
          [x, y + d - e, z + h],
          [x + w - e, y + d - e, z + h],
          [x + w - e, y + d, z + h],
          [x, y + d, z + h],
        ],
        shade(c.top, 0.35),
        0.7,
      );
      this.face(
        [
          [x + w - e, y, z + h],
          [x + w, y, z + h],
          [x + w, y + d, z + h],
          [x + w - e, y + d, z + h],
        ],
        shade(c.top, 0.35),
        0.7,
      );
    }
    return this;
  }

  /** 物の足元の柔らかい影（床の面に落とす） */
  shadow(x: number, y: number, w: number, d: number, z = 0, spread = 0.35): this {
    const c = project(this.f, x + w / 2, y + d / 2, z);
    const u = this.f.u;
    const rx = ((w + d) / 2 + spread) * 0.95 * u;
    const ry = rx * 0.52;
    this.g.ellipse(c.x, c.y + u * 0.05, rx, ry).fill({ fill: softShadow() });
    return this;
  }

  /** 光だまり（床に重ねる） */
  lightPool(x: number, y: number, r: number, color: number, alpha: number): this {
    const c = project(this.f, x, y, 0);
    const rx = r * this.f.u * 1.2;
    this.g.ellipse(c.x, c.y, rx, rx * 0.55).fill({ fill: glow(), alpha, color });
    return this;
  }
}
