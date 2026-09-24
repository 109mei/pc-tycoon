import type { Graphics } from 'pixi.js';
import { project, type IsoFrame } from './isoMath';

export { COS30, project, type IsoFrame } from './isoMath';

/** 箱の3面の色。右の面（+x向き）は明るめ、左の面（+y向き）は暗め */
export interface BoxColors {
  top: number;
  left: number;
  right: number;
}

export class IsoPainter {
  constructor(
    public g: Graphics,
    public f: IsoFrame,
  ) {}

  private flat(points: [number, number, number][]): number[] {
    const out: number[] = [];
    for (const [x, y, z] of points) {
      const p = project(this.f, x, y, z);
      out.push(p.x, p.y);
    }
    return out;
  }

  face(points: [number, number, number][], color: number, alpha = 1): this {
    this.g.poly(this.flat(points)).fill({ color, alpha });
    return this;
  }

  /** 床と平行な四角（z の高さ） */
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

  /** 左の壁の面（x が一定の面） */
  wallX(x: number, y0: number, y1: number, z0: number, z1: number, color: number, alpha = 1): this {
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

  /** 右の壁の面（y が一定の面） */
  wallY(y: number, x0: number, x1: number, z0: number, z1: number, color: number, alpha = 1): this {
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

  /** 見える3面（上・左・右）を塗った箱 */
  box(x: number, y: number, z: number, w: number, d: number, h: number, c: BoxColors): this {
    // 左の面（y = y+d）
    this.face(
      [
        [x, y + d, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x, y + d, z + h],
      ],
      c.left,
    );
    // 右の面（x = x+w）
    this.face(
      [
        [x + w, y, z],
        [x + w, y + d, z],
        [x + w, y + d, z + h],
        [x + w, y, z + h],
      ],
      c.right,
    );
    return this.flatRect(x, y, x + w, y + d, z + h, c.top);
  }

  /** 床に置いた楕円（影・足元の輪） */
  floorEllipse(x: number, y: number, rx: number, ry: number, color: number, alpha = 1): this {
    const p = project(this.f, x, y, 0);
    this.g.ellipse(p.x, p.y, rx, ry).fill({ color, alpha });
    return this;
  }
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

/** 1色から箱の3面の色を作る */
export function boxOf(base: number, topLift = 0.18, leftDrop = -0.14): BoxColors {
  return { top: shade(base, topLift), left: shade(base, leftDrop), right: base };
}
